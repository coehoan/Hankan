create table public.receipt_drafts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  fridge_id uuid not null references public.fridges (id) on delete cascade,
  object_path text not null unique,
  status text not null default 'uploaded' check (
    status in (
      'uploaded',
      'analyzing',
      'ready',
      'failed',
      'saved',
      'cancelled'
    )
  ),
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array'),
  analysis_run uuid,
  analysis_started_at timestamptz,
  error_code text,
  request_id uuid,
  commit_payload jsonb,
  commit_result jsonb,
  cleanup_pending boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp() + interval '24 hours'
);

create index receipt_cleanup_idx on public.receipt_drafts (cleanup_pending, expires_at);

alter table public.receipt_drafts enable row level security;

revoke all on public.receipt_drafts
from
  anon,
  authenticated;

grant
select
  on public.receipt_drafts to authenticated;

grant all on public.receipt_drafts to service_role;

create policy receipt_private_read on public.receipt_drafts for
select
  to authenticated using (
    user_id = auth.uid ()
    and private.is_fridge_member (fridge_id)
    and expires_at > now()
  );

insert into
  storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
  )
values
  (
    'receipt-originals',
    'receipt-originals',
    false,
    10485760,
    array['image/png']
  )
on conflict (id) do update
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/png'];

-- No authenticated storage policies: upload, download and signing use the checked server only.
create function public.create_receipt_draft (draft_id uuid, target_fridge_id uuid) returns public.receipt_drafts language plpgsql security definer
set
  search_path = '' as $$
declare actor uuid; result public.receipt_drafts;
begin
 actor:=private.lock_inventory_membership(target_fridge_id);
 if (select count(*) from public.receipt_drafts where user_id=actor and status not in ('saved','cancelled') and expires_at>clock_timestamp())>=20 then
  raise exception 'Too many drafts' using errcode='PT409';
 end if;
 insert into public.receipt_drafts(id,user_id,fridge_id,object_path)
 values(draft_id,actor,target_fridge_id,actor::text||'/'||draft_id::text||'/original.png') returning * into result;
 return result;
end;$$;

create function public.start_receipt_analysis (draft_id uuid) returns uuid language plpgsql security definer
set
  search_path = '' as $$
declare d public.receipt_drafts; run uuid:=gen_random_uuid(); fid uuid;
begin
 select fridge_id into fid from public.receipt_drafts where id=draft_id and user_id=auth.uid();
 if not found then raise exception 'Draft unavailable' using errcode='P0002';end if;
 perform private.lock_inventory_membership(fid);
 select * into d from public.receipt_drafts where id=draft_id and user_id=auth.uid() for update;
 if d.expires_at<=clock_timestamp() or d.status in ('saved','cancelled','ready') or
 (d.status='analyzing' and d.analysis_started_at>clock_timestamp()-interval '5 minutes') then
  raise exception 'Draft is not available for analysis' using errcode='PT409';end if;
 update public.receipt_drafts set status='analyzing',analysis_run=run,analysis_started_at=clock_timestamp(),error_code=null where id=draft_id;
 return run;
end;$$;

create function public.finish_receipt_analysis (
  draft_id uuid,
  run_id uuid,
  extracted jsonb,
  succeeded boolean
) returns boolean language plpgsql security definer
set
  search_path = '' as $$
declare d public.receipt_drafts;
begin
 select * into d from public.receipt_drafts where id=draft_id;
 if not found then return false;end if;
 perform 1 from public.fridge_members where fridge_id=d.fridge_id and user_id=d.user_id for share;
 if not found then
  update public.receipt_drafts set status='cancelled',cleanup_pending=true where id=draft_id and status not in ('saved','cancelled');return false;
 end if;
 select * into d from public.receipt_drafts where id=draft_id for update;
 if d.status<>'analyzing' or d.analysis_run is distinct from run_id or d.expires_at<=clock_timestamp() then return false;end if;
 if succeeded and (jsonb_typeof(extracted) is distinct from 'array' or jsonb_array_length(extracted)>100) then raise exception 'Invalid analysis' using errcode='22023';end if;
 update public.receipt_drafts set status=case when succeeded then 'ready' else 'failed' end,
 items=case when succeeded then extracted else '[]'::jsonb end,error_code=case when succeeded then null else 'provider_failed' end where id=draft_id;
 return true;
end;$$;

create function public.commit_receipt (
  draft_id uuid,
  commit_request uuid,
  confirmed_items jsonb
) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare d public.receipt_drafts; fid uuid; actor uuid; entry jsonb; canonical jsonb:='[]'; value jsonb; result jsonb:='[]'; inserted public.ingredients;
begin
 if commit_request is null then raise exception 'Request required' using errcode='22023';end if;
 select fridge_id into fid from public.receipt_drafts where id=draft_id and user_id=auth.uid();
 if not found then raise exception 'Draft unavailable' using errcode='P0002';end if;
 actor:=private.lock_inventory_membership(fid);
 select * into d from public.receipt_drafts where id=draft_id and user_id=actor for update;
 if d.expires_at<=clock_timestamp() then raise exception 'Draft expired' using errcode='PT409';end if;
 if jsonb_typeof(confirmed_items) is distinct from 'array' or jsonb_array_length(confirmed_items) not between 1 and 100 then raise exception 'Items required' using errcode='22023';end if;
 for entry in select * from jsonb_array_elements(confirmed_items) loop
  if jsonb_typeof(entry) is distinct from 'object' or entry-array['name','storage','expiresOn']<>'{}'::jsonb then raise exception 'Invalid item' using errcode='22023';end if;
  value:=private.validate_ingredient_input(entry||jsonb_build_object('requestId',commit_request),false);
  canonical:=canonical||jsonb_build_array(value);
 end loop;
 if d.status='saved' then
  if d.request_id=commit_request and d.commit_payload=canonical then return d.commit_result;end if;
  raise exception 'Draft already saved' using errcode='PT409';
 end if;
 if d.status not in ('uploaded','ready','failed') then raise exception 'Draft cannot be saved' using errcode='PT409';end if;
 for value in select * from jsonb_array_elements(canonical) loop
  insert into public.ingredients(fridge_id,name,storage,expires_on,created_by,updated_by)
  values(fid,value->>'name',value->>'storage',(value->>'expiresOn')::date,actor,actor) returning * into inserted;
  result:=result||jsonb_build_array(to_jsonb(inserted));
 end loop;
 update public.receipt_drafts set status='saved',request_id=commit_request,commit_payload=canonical,commit_result=result,cleanup_pending=true where id=draft_id;
 return result;
end;$$;

create function public.cancel_receipt (draft_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
declare d public.receipt_drafts;
begin
 select * into d from public.receipt_drafts where id=draft_id and user_id=auth.uid() for update;
 if not found then raise exception 'Draft unavailable' using errcode='P0002';end if;
 -- Allow the uploader to dispose of their own file even after fridge access is lost.
 update public.receipt_drafts set status=case when status='saved' then 'saved' else 'cancelled' end,cleanup_pending=true where id=draft_id;
end;$$;

create function public.expire_receipts () returns void language sql security definer
set
  search_path = '' as $$
 update public.receipt_drafts set status='cancelled',cleanup_pending=true
 where expires_at<=clock_timestamp() and status not in ('saved','cancelled');
$$;

revoke all on function public.create_receipt_draft (uuid, uuid),
public.start_receipt_analysis (uuid),
public.commit_receipt (uuid, uuid, jsonb),
public.cancel_receipt (uuid),
public.finish_receipt_analysis (uuid, uuid, jsonb, boolean),
public.expire_receipts ()
from
  public,
  anon,
  authenticated;

grant
execute on function public.create_receipt_draft (uuid, uuid),
public.start_receipt_analysis (uuid),
public.commit_receipt (uuid, uuid, jsonb),
public.cancel_receipt (uuid) to authenticated;

grant
execute on function public.finish_receipt_analysis (uuid, uuid, jsonb, boolean),
public.expire_receipts () to service_role;
