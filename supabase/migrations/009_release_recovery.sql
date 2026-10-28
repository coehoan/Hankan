-- A schedule moved to another day must not leave an entirely unsent job live.
-- Partially delivered digests keep their existing retry policy for other devices.
create or replace function private.reschedule_unsent_job() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.enabled then
  update public.notification_jobs j set status='skipped',lease_until=null,lease_token=null
  where j.user_id=new.user_id and j.local_date<>(new.next_run_at at time zone new.timezone)::date
  and j.status in('pending','retry','leased')
  and not exists(select 1 from public.notification_deliveries d where d.job_id=j.id and d.status='sent');
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

-- Retire obsolete entirely-unsent work left by the previous trigger as well.
update public.notification_jobs j set status='skipped',lease_until=null,lease_token=null
from public.notification_preferences p
where j.user_id=p.user_id and p.enabled and p.next_run_at is not null
and j.local_date<>(p.next_run_at at time zone p.timezone)::date
and j.status in('pending','retry','leased')
and not exists(select 1 from public.notification_deliveries d where d.job_id=j.id and d.status='sent');

-- Reconcile only expired internal analysis leases when the owner resumes/polls.
-- Current membership and the row lock serialize recovery with commits/new runs.
-- Review work is retained and clearing analysis_run fences late provider results.
create function public.recover_receipt_analysis(draft_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare fid uuid; d public.receipt_drafts;
begin
 select fridge_id into fid from public.receipt_drafts where id=draft_id and user_id=auth.uid();
 if not found then raise exception 'Draft unavailable' using errcode='P0002'; end if;
 perform private.lock_inventory_membership(fid);
 select * into d from public.receipt_drafts where id=draft_id and user_id=auth.uid() for update;
 if d.status<>'analyzing' or d.expires_at<=clock_timestamp() or d.analysis_started_at>clock_timestamp()-interval '5 minutes' then return false; end if;
 update public.receipt_drafts set status='failed',analysis_run=null,analysis_started_at=null,error_code='analysis_interrupted' where id=d.id;
 return true;
end;
$$;
revoke all on function public.recover_receipt_analysis(uuid) from public,anon;
grant execute on function public.recover_receipt_analysis(uuid) to authenticated;
