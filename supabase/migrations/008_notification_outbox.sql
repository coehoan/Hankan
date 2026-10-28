create table public.notification_jobs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 local_date date not null,
 due_at timestamptz not null,
 status text not null default 'pending' check(status in('pending','leased','sent','skipped','retry')),
 lease_until timestamptz,
 lease_token uuid,
 attempts integer not null default 0,
 unique(user_id,local_date)
);
create index notification_jobs_due on public.notification_jobs(due_at) where status in('pending','retry','leased');
create table public.notification_deliveries (
 job_id uuid not null references public.notification_jobs(id) on delete cascade,
 subscription_id uuid not null,
 status text not null check(status in('sent','gone')),
 created_at timestamptz not null default now(),
 primary key(job_id,subscription_id)
);
alter table public.notification_jobs enable row level security;
alter table public.notification_deliveries enable row level security;
revoke all on public.notification_jobs,public.notification_deliveries from anon,authenticated;
grant all on public.notification_jobs,public.notification_deliveries to service_role;

-- Only scheduling-input changes recompute next_run_at. The worker may advance it
-- without falsely recording an empty digest as sent.
drop trigger notification_preferences_schedule on public.notification_preferences;
create trigger notification_preferences_schedule before insert or update of enabled,local_time,timezone,last_sent_local_date on public.notification_preferences
for each row execute function private.refresh_notification_schedule();
create function private.reschedule_unsent_job() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.enabled then
  update public.notification_jobs j set status='pending',due_at=new.next_run_at,lease_until=null,lease_token=null,attempts=0
  where j.user_id=new.user_id and j.local_date=(new.next_run_at at time zone new.timezone)::date
  and j.status in('pending','retry','skipped','leased')
  and not exists(select 1 from public.notification_deliveries d where d.job_id=j.id and d.status='sent');
 else
  update public.notification_jobs set status='skipped',lease_until=null,lease_token=null where user_id=new.user_id and status in('pending','retry','leased');
 end if;
 return new;
end;
$$;
create trigger notification_reschedule after update of enabled,local_time,timezone on public.notification_preferences for each row execute function private.reschedule_unsent_job();

create function private.notification_groups(actor uuid,day date) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('fridgeId',f.id,'fridgeName',f.name,'ingredients',items.value) order by f.id),'[]'::jsonb)
 from public.fridge_members m join public.fridges f on f.id=m.fridge_id
 cross join lateral(select jsonb_agg(to_jsonb(i) order by i.expires_on,i.id) value from public.ingredients i
  where i.fridge_id=f.id and i.remaining_percent>0 and i.expires_on between day and day+3) items
 where m.user_id=actor and items.value is not null;
$$;

create function public.claim_notification_jobs(at_time timestamptz,batch_limit integer) returns setof public.notification_jobs
language plpgsql security definer set search_path='' as $$
declare pref public.notification_preferences; job public.notification_jobs; day date;
begin
 if batch_limit<1 or batch_limit>100 or not isfinite(at_time) then raise exception 'Invalid batch' using errcode='22023'; end if;
 -- Preference-first locking is shared by all mutation RPCs to avoid lock inversion.
 for pref in select p.* from public.notification_preferences p where p.enabled and
  (p.next_run_at<=at_time or exists(select 1 from public.notification_jobs j where j.user_id=p.user_id and
   (j.status in('pending','retry') and j.due_at<=at_time or j.status='leased' and j.lease_until<=at_time)))
  order by p.next_run_at for update skip locked limit batch_limit
 loop
  day:=(at_time at time zone pref.timezone)::date;
  if pref.next_run_at<=at_time and pref.last_sent_local_date is distinct from day then
   insert into public.notification_jobs(user_id,local_date,due_at) values(pref.user_id,day,pref.next_run_at)
   on conflict(user_id,local_date) do nothing;
  end if;
  update public.notification_jobs set status='skipped',lease_until=null,lease_token=null
   where user_id=pref.user_id and local_date<>day and status in('pending','retry','leased');
  select * into job from public.notification_jobs j where j.user_id=pref.user_id and j.local_date=day and
   (j.status in('pending','retry') and j.due_at<=at_time or j.status='leased' and j.lease_until<=at_time)
   for update skip locked;
  if found then
   update public.notification_jobs set status='leased',lease_until=at_time+interval '5 minutes',lease_token=gen_random_uuid(),attempts=attempts+1
   where id=job.id returning * into job;
   return next job;
  end if;
 end loop;
end;
$$;

create function public.prepare_notification_dispatch(job_id uuid,token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job public.notification_jobs; pref public.notification_preferences; result jsonb; clock timestamptz:=clock_timestamp();
begin
 select p.* into pref from public.notification_preferences p join public.notification_jobs j on j.user_id=p.user_id where j.id=job_id for update of p;
 select * into job from public.notification_jobs where id=job_id for update;
 if job.status<>'leased' or job.lease_token is distinct from token or job.lease_until<=clock or not pref.enabled
 or job.local_date<>(clock at time zone pref.timezone)::date then return null; end if;
 result:=private.notification_groups(job.user_id,job.local_date);
 if jsonb_array_length(result)=0 then return null; end if;
 update public.notification_jobs set lease_until=clock+interval '5 minutes' where id=job_id;
 return jsonb_build_object('userId',job.user_id,'localDate',job.local_date,'groups',result,'subscriptions',
  coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'userId',s.user_id,'endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth))
   from public.push_subscriptions s where s.user_id=job.user_id and not exists(select 1 from public.notification_deliveries d where d.job_id=job.id and d.subscription_id=s.id)),'[]'::jsonb));
end;
$$;
create function public.record_notification_delivery(job_id uuid,token uuid,subscription_id uuid,delivery_status text) returns void
language plpgsql security definer set search_path='' as $$
declare job public.notification_jobs;
begin
 perform 1 from public.notification_preferences p join public.notification_jobs j on j.user_id=p.user_id where j.id=job_id for update of p;
 select * into job from public.notification_jobs where id=job_id for update;
 if job.status<>'leased' or job.lease_token is distinct from token or job.lease_until<=clock_timestamp() then raise exception 'Lease lost' using errcode='40001'; end if;
 if delivery_status not in('sent','gone') then raise exception 'Invalid delivery' using errcode='22023'; end if;
 insert into public.notification_deliveries(job_id,subscription_id,status) values(job_id,subscription_id,delivery_status) on conflict do nothing;
 if delivery_status='gone' then delete from public.push_subscriptions where id=subscription_id and user_id=job.user_id;
 else update public.notification_preferences set last_sent_local_date=job.local_date where user_id=job.user_id and last_sent_local_date is distinct from job.local_date; end if;
end;
$$;
create function public.finish_notification_job(job_id uuid,token uuid,will_retry boolean) returns void
language plpgsql security definer set search_path='' as $$
declare job public.notification_jobs; pref public.notification_preferences; did_send boolean;
begin
 select p.* into pref from public.notification_preferences p join public.notification_jobs j on j.user_id=p.user_id where j.id=job_id for update of p;
 select * into job from public.notification_jobs where id=job_id for update;
 if job.status<>'leased' or job.lease_token is distinct from token or job.lease_until<=clock_timestamp() then return; end if;
 select exists(select 1 from public.notification_deliveries d where d.job_id=job.id and d.status='sent') into did_send;
 if will_retry and pref.enabled and job.attempts<10 then
  update public.notification_jobs set status='retry',due_at=clock_timestamp()+make_interval(secs=>least(3600,30*power(2,least(attempts,7))::integer)),lease_until=null,lease_token=null where id=job.id;
 else
  update public.notification_jobs set status=case when did_send then 'sent' else 'skipped' end,lease_until=null,lease_token=null where id=job.id;
  if pref.enabled then update public.notification_preferences set next_run_at=private.next_notification_at(clock_timestamp(),pref.timezone,pref.local_time,greatest(job.local_date,pref.last_sent_local_date)) where user_id=job.user_id; end if;
 end if;
end;
$$;
create function public.read_notification_digest(digest_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare job public.notification_jobs; zone text; day date;
begin
 select * into job from public.notification_jobs where id=digest_id and user_id=auth.uid();
 if not found then raise exception 'Digest unavailable' using errcode='P0002'; end if;
 select timezone into zone from public.notification_preferences where user_id=job.user_id;
 day:=(now() at time zone zone)::date;
 return jsonb_build_object('userId',job.user_id,'localDate',day,'groups',private.notification_groups(job.user_id,day));
end;
$$;
revoke all on function private.reschedule_unsent_job(),private.notification_groups(uuid,date) from public,anon,authenticated;
revoke all on function public.claim_notification_jobs(timestamptz,integer),public.prepare_notification_dispatch(uuid,uuid),public.record_notification_delivery(uuid,uuid,uuid,text),public.finish_notification_job(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_notification_jobs(timestamptz,integer),public.prepare_notification_dispatch(uuid,uuid),public.record_notification_delivery(uuid,uuid,uuid,text),public.finish_notification_job(uuid,uuid,boolean) to service_role;
revoke all on function public.read_notification_digest(uuid) from public,anon;
grant execute on function public.read_notification_digest(uuid) to authenticated;
