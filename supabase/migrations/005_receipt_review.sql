alter table public.receipt_drafts
add column review_items jsonb;

create function public.save_receipt_review (draft_id uuid, review jsonb) returns void language plpgsql security definer
set
  search_path = '' as $$
declare fid uuid; d public.receipt_drafts; entry jsonb;
begin
 select fridge_id into fid from public.receipt_drafts where id=draft_id and user_id=auth.uid();
 if not found then raise exception 'Draft unavailable' using errcode='P0002';end if;
 perform private.lock_inventory_membership(fid);
 select * into d from public.receipt_drafts where id=draft_id for update;
 if d.status not in ('uploaded','ready','failed') or d.expires_at<=clock_timestamp() then raise exception 'Draft cannot be edited' using errcode='PT409';end if;
 if jsonb_typeof(review) is distinct from 'array' or jsonb_array_length(review)>100 or octet_length(review::text)>131072 then raise exception 'Invalid review' using errcode='22023';end if;
 for entry in select * from jsonb_array_elements(review) loop
  if jsonb_typeof(entry) is distinct from 'object' or not entry ?& array['id','name','storage','expiresOn','included','rawText','needsReview'] or entry-array['id','name','storage','expiresOn','included','rawText','needsReview']<>'{}'::jsonb
   or jsonb_typeof(entry->'id') is distinct from 'string' or char_length(entry->>'id') not between 1 and 100
   or jsonb_typeof(entry->'name') is distinct from 'string' or char_length(entry->>'name')>80
   or jsonb_typeof(entry->'rawText') is distinct from 'string' or char_length(entry->>'rawText')>1000
   or jsonb_typeof(entry->'included') is distinct from 'boolean' or jsonb_typeof(entry->'needsReview') is distinct from 'boolean'
   or jsonb_typeof(entry->'storage') is distinct from 'string' or entry->>'storage' not in ('fridge','freezer','pantry')
   or jsonb_typeof(entry->'expiresOn') is distinct from 'string' then raise exception 'Invalid review item' using errcode='22023';end if;
  if entry->>'expiresOn'<>'' then perform private.ingredient_date(entry->>'expiresOn');end if;
 end loop;
 update public.receipt_drafts set review_items=review where id=draft_id;
end;$$;

revoke all on function public.save_receipt_review (uuid, jsonb)
from
  public,
  anon;

grant
execute on function public.save_receipt_review (uuid, jsonb) to authenticated;

create function private.cancel_departed_receipts () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
 update public.receipt_drafts set status='cancelled',cleanup_pending=true
 where fridge_id=old.fridge_id and user_id=old.user_id and status not in ('saved','cancelled');
 return old;
end;$$;

revoke all on function private.cancel_departed_receipts ()
from
  public,
  anon,
  authenticated;

create trigger receipt_membership_removed
after delete on public.fridge_members for each row
execute function private.cancel_departed_receipts ();
