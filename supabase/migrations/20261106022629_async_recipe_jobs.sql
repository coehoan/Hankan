create table public.recipe_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fridge_id uuid not null references public.fridges (id) on delete cascade,
  request_id uuid not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'array'),
  today date not null,
  status text not null default 'queued' check (
    status in (
      'queued',
      'running',
      'complete',
      'failed',
      'cancelled'
    )
  ),
  catalog_state text not null default 'pending' check (
    catalog_state in ('pending', 'complete', 'failed')
  ),
  ai_state text not null default 'pending' check (ai_state in ('pending', 'complete', 'failed')),
  catalog_recipes jsonb not null default '[]' check (jsonb_typeof(catalog_recipes) = 'array'),
  ai_recipes jsonb not null default '[]' check (jsonb_typeof(ai_recipes) = 'array'),
  attempts integer not null default 0,
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  notified_at timestamptz,
  notify_token uuid,
  notify_until timestamptz,
  notify_attempts integer not null default 0,
  delivered_subscription_ids uuid[] not null default '{}',
  unique (user_id, request_id)
);

create unique index recipe_jobs_active on public.recipe_jobs (user_id, fridge_id)
where
  status in ('queued', 'running');

create index recipe_jobs_history on public.recipe_jobs (user_id, created_at desc);

create index recipe_jobs_pending on public.recipe_jobs (status, lease_until, created_at)
where
  status in ('queued', 'running');

alter table public.recipe_jobs enable row level security;

revoke all on public.recipe_jobs
from
  anon,
  authenticated;

grant
select
  on public.recipe_jobs to authenticated;

grant all on public.recipe_jobs to service_role;

create policy recipe_jobs_read on public.recipe_jobs for
select
  to authenticated using (
    user_id = (
      select
        auth.uid ()
    )
    and exists (
      select
        1
      from
        public.fridge_members m
      where
        m.fridge_id = recipe_jobs.fridge_id
        and m.user_id = (
          select
            auth.uid ()
        )
    )
  );

-- Keep every accepted request ID, including requests that reused an active job.
create table public.recipe_job_requests (
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null,
  job_id uuid not null references public.recipe_jobs (id) on delete cascade,
  primary key (user_id, request_id)
);

create index recipe_job_requests_job on public.recipe_job_requests (job_id);

alter table public.recipe_job_requests enable row level security;

revoke all on public.recipe_job_requests
from
  public,
  anon,
  authenticated;

grant all on public.recipe_job_requests to service_role;

create function public.enqueue_recipe_job (target_fridge_id uuid, request_id uuid) returns public.recipe_jobs language plpgsql security definer
set
  search_path = '' as $$
declare actor uuid:=auth.uid(); job public.recipe_jobs; frozen jsonb; local_today date;
begin
 perform 1 from public.fridges where id=target_fridge_id for update;
 perform private.lock_inventory_membership(target_fridge_id);
 if $2 is null then raise exception 'Request ID required' using errcode='22023';end if;
 -- Serialize this user's quota and cross-fridge idempotency checks.
 perform 1 from public.profiles where user_id=actor for update;
 select j.* into job from public.recipe_job_requests r join public.recipe_jobs j on j.id=r.job_id where r.user_id=actor and r.request_id=$2;
 if found then
  if job.fridge_id<>target_fridge_id then raise exception 'Request ID conflict' using errcode='PT409';end if;
  return job;
 end if;
 select * into job from public.recipe_jobs j where j.user_id=actor and j.fridge_id=target_fridge_id and j.status in ('queued','running');
 if found then
  insert into public.recipe_job_requests(user_id,request_id,job_id) values(actor,$2,job.id);
  return job;
 end if;
 if (select count(*) from public.recipe_jobs j where j.user_id=actor and j.created_at>now()-interval '1 hour')>=10 then
  raise exception 'Recipe request limit reached' using errcode='PT429';
 end if;
 select (now() at time zone p.timezone)::date into local_today from public.profiles p where p.user_id=actor;
 local_today:=coalesce(local_today,(now() at time zone 'Asia/Seoul')::date);
 select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb) into frozen from public.ingredients i where i.fridge_id=target_fridge_id;
 if not exists(select 1 from public.ingredients i where i.fridge_id=target_fridge_id and i.remaining_percent>0 and i.expires_on>=local_today) then
  raise exception 'No usable ingredients' using errcode='22023';
 end if;
 insert into public.recipe_jobs(user_id,fridge_id,request_id,snapshot,today) values(actor,target_fridge_id,$2,frozen,local_today) returning * into job;
 insert into public.recipe_job_requests(user_id,request_id,job_id) values(actor,$2,job.id);
 return job;
end;$$;

create function public.claim_recipe_jobs (target_job_id uuid default null) returns setof public.recipe_jobs language plpgsql security definer
set
  search_path = '' as $$
declare job public.recipe_jobs;
begin
 for job in select * from public.recipe_jobs j where ($1 is null or j.id=$1) and j.status in ('queued','running') and (j.lease_until is null or j.lease_until<now()) order by j.created_at for update skip locked limit 2 loop
  if not exists(select 1 from public.fridge_members m where m.fridge_id=job.fridge_id and m.user_id=job.user_id) then
   update public.recipe_jobs set status='cancelled',updated_at=now(),completed_at=now(),lease_token=null,lease_until=null where id=job.id;
  elsif job.attempts>=3 then
   update public.recipe_jobs set status=case when catalog_state='complete' or ai_state='complete' then 'complete' else 'failed' end,catalog_state=case when catalog_state='pending' then 'failed' else catalog_state end,ai_state=case when ai_state='pending' then 'failed' else ai_state end,completed_at=now(),updated_at=now(),lease_token=null,lease_until=null where id=job.id;
  else
   update public.recipe_jobs set status='running',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '120 seconds',updated_at=now() where id=job.id returning * into job;
   return next job;
  end if;
 end loop;
end;$$;

create function public.publish_recipe_source (
  job_id uuid,
  token uuid,
  source_name text,
  recipes jsonb,
  succeeded boolean
) returns boolean language plpgsql security definer
set
  search_path = '' as $$
declare job public.recipe_jobs;
begin
 if source_name not in ('catalog','ai') or recipes is null or jsonb_typeof(recipes)<>'array' or jsonb_array_length(recipes)>30 or octet_length(recipes::text)>2000000 then raise exception 'Invalid recipe result' using errcode='22023';end if;
 select * into job from public.recipe_jobs j where j.id=$1 for update;
 if not found or job.status<>'running' or job.lease_token is distinct from token or job.lease_until<now() then return false;end if;
 if not exists(select 1 from public.fridge_members m where m.fridge_id=job.fridge_id and m.user_id=job.user_id) then
  update public.recipe_jobs set status='cancelled',updated_at=now(),completed_at=now(),lease_token=null,lease_until=null where id=job.id;
  return false;
 end if;
 if source_name='catalog' and job.catalog_state='pending' then
  update public.recipe_jobs set catalog_state=case when succeeded then 'complete' else 'failed' end,catalog_recipes=case when succeeded then recipes else '[]'::jsonb end where id=job.id;
 elsif source_name='ai' and job.ai_state='pending' then
  update public.recipe_jobs set ai_state=case when succeeded then 'complete' else 'failed' end,ai_recipes=case when succeeded then recipes else '[]'::jsonb end where id=job.id;
 end if;
 update public.recipe_jobs set updated_at=now(),status=case when catalog_state='pending' or ai_state='pending' then 'running' when catalog_state='complete' or ai_state='complete' then 'complete' else 'failed' end,completed_at=case when catalog_state<>'pending' and ai_state<>'pending' then now() else null end where id=job.id returning * into job;
 if job.status<>'running' then update public.recipe_jobs set lease_token=null,lease_until=null where id=job.id;end if;
 return true;
end;$$;

create function public.claim_recipe_notifications () returns setof public.recipe_jobs language plpgsql security definer
set
  search_path = '' as $$
begin
 return query update public.recipe_jobs j set notify_token=gen_random_uuid(),notify_until=now()+interval '120 seconds',notify_attempts=notify_attempts+1
 where j.id in (select r.id from public.recipe_jobs r where r.status in ('complete','failed') and r.notified_at is null and r.notify_attempts<3 and (r.notify_until is null or r.notify_until<now()) order by r.completed_at for update skip locked limit 5) returning j.*;
end;$$;

create function public.prepare_recipe_notification (job_id uuid, token uuid) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare job public.recipe_jobs; subscriptions jsonb;
begin
 select * into job from public.recipe_jobs j where j.id=$1 and j.notify_token=$2 and j.notify_until>now() and j.notified_at is null for update;
 if not found then return null;end if;
 if not exists(select 1 from public.fridge_members m where m.fridge_id=job.fridge_id and m.user_id=job.user_id) or not exists(select 1 from public.notification_preferences p where p.user_id=job.user_id and p.enabled) then
  update public.recipe_jobs set notified_at=now(),notify_token=null,notify_until=null where id=job.id;
  return null;
 end if;
 select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) into subscriptions from public.push_subscriptions s where s.user_id=job.user_id and not(s.id=any(job.delivered_subscription_ids));
 return subscriptions;
end;$$;

create function public.record_recipe_notification (job_id uuid, token uuid, subscription_id uuid) returns boolean language plpgsql security definer
set
  search_path = '' as $$
begin
 update public.recipe_jobs j set delivered_subscription_ids=array_append(j.delivered_subscription_ids,$3) where j.id=$1 and j.notify_token=$2 and j.notify_until>now() and not($3=any(j.delivered_subscription_ids));
 return found;
end;$$;

revoke all on function public.enqueue_recipe_job (uuid, uuid)
from
  public,
  anon,
  authenticated;

grant
execute on function public.enqueue_recipe_job (uuid, uuid) to authenticated;

revoke all on function public.claim_recipe_jobs (uuid),
public.publish_recipe_source (uuid, uuid, text, jsonb, boolean),
public.claim_recipe_notifications (),
public.prepare_recipe_notification (uuid, uuid),
public.record_recipe_notification (uuid, uuid, uuid)
from
  public,
  anon,
  authenticated;

grant
execute on function public.claim_recipe_jobs (uuid),
public.publish_recipe_source (uuid, uuid, text, jsonb, boolean),
public.claim_recipe_notifications (),
public.prepare_recipe_notification (uuid, uuid),
public.record_recipe_notification (uuid, uuid, uuid) to service_role;
