alter table public.recipe_jobs
add column selected_ingredient_ids uuid[];

alter table public.recipe_jobs
add constraint recipe_jobs_selection_size check (
  selected_ingredient_ids is null
  or cardinality(selected_ingredient_ids) between 1 and 1000
);

-- Replace rather than overload: PostgREST must resolve legacy two-argument calls too.
drop function public.enqueue_recipe_job (uuid, uuid);

create function public.enqueue_recipe_job (
  target_fridge_id uuid,
  request_id uuid,
  selected_ingredient_ids uuid[] default null
) returns public.recipe_jobs language plpgsql security definer
set
  search_path = '' as $$
declare
 actor uuid := auth.uid(); job public.recipe_jobs; frozen jsonb; local_today date;
 selection uuid[];
begin
 perform 1 from public.fridges where id=target_fridge_id for update;
 perform private.lock_inventory_membership(target_fridge_id);
 if request_id is null then raise exception 'Request ID required' using errcode='22023'; end if;
 if selected_ingredient_ids is not null then
  if cardinality(selected_ingredient_ids) not between 1 and 1000 or array_position(selected_ingredient_ids,null) is not null then
   raise exception 'Invalid ingredient selection' using errcode='22023';
  end if;
  select array_agg(distinct id order by id) into selection from unnest(selected_ingredient_ids) as selected(id);
  if cardinality(selection)<>cardinality(selected_ingredient_ids) then
   raise exception 'Duplicate ingredient selection' using errcode='22023';
  end if;
 end if;
 perform 1 from public.profiles where user_id=actor for update;
 select j.* into job from public.recipe_job_requests r join public.recipe_jobs j on j.id=r.job_id where r.user_id=actor and r.request_id=$2;
 if found then
  if job.fridge_id<>target_fridge_id or job.selected_ingredient_ids is distinct from selection then
   raise exception 'Request ID conflict' using errcode='PT409';
  end if;
  return job;
 end if;
 select (now() at time zone p.timezone)::date into local_today from public.profiles p where p.user_id=actor;
 local_today:=coalesce(local_today,(now() at time zone 'Asia/Seoul')::date);
 -- Validate and persist the SAME MVCC snapshot: shared inventory may change concurrently.
 select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb) into frozen from public.ingredients i where i.fridge_id=target_fridge_id;
 if selection is not null and (
  select count(*) from jsonb_array_elements(frozen) as stock(i) where (i->>'id')::uuid=any(selection)
  and (i->>'remaining_percent')::integer>0 and (i->>'expires_on')::date>=local_today
 )<>cardinality(selection) then
  raise exception 'Selected ingredients are no longer available' using errcode='22023';
 end if;
 select * into job from public.recipe_jobs j where j.user_id=actor and j.fridge_id=target_fridge_id and j.status in ('queued','running');
 if found and job.selected_ingredient_ids is distinct from selection then
  raise exception 'Another recommendation is in progress' using errcode='PT409';
 end if;
 -- Bound new aliases too; known request IDs were recovered before this check.
 if (select count(*) from public.recipe_job_requests r join public.recipe_jobs j on j.id=r.job_id where r.user_id=actor and j.created_at>now()-interval '1 hour')>=100 then
  raise exception 'Recipe request limit reached' using errcode='PT429';
 end if;
 if job.id is not null then
  insert into public.recipe_job_requests(user_id,request_id,job_id) values(actor,$2,job.id);
  return job;
 end if;
 if (select count(*) from public.recipe_jobs j where j.user_id=actor and j.created_at>now()-interval '1 hour')>=10 then
  raise exception 'Recipe request limit reached' using errcode='PT429';
 end if;
 if not exists(select 1 from jsonb_array_elements(frozen) as stock(i) where (i->>'remaining_percent')::integer>0 and (i->>'expires_on')::date>=local_today) then
  raise exception 'No usable ingredients' using errcode='22023';
 end if;
 insert into public.recipe_jobs(user_id,fridge_id,request_id,snapshot,today,selected_ingredient_ids)
 values(actor,target_fridge_id,$2,frozen,local_today,selection) returning * into job;
 insert into public.recipe_job_requests(user_id,request_id,job_id) values(actor,$2,job.id);
 return job;
end; $$;

revoke all on function public.enqueue_recipe_job (uuid, uuid, uuid[])
from
  public,
  anon,
  authenticated;

grant
execute on function public.enqueue_recipe_job (uuid, uuid, uuid[]) to authenticated;
