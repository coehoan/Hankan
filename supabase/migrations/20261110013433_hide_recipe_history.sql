alter table public.recipe_jobs
add column history_hidden_at timestamptz;

-- Keep the existing ownership and membership policy for every client read.
create policy recipe_jobs_visible on public.recipe_jobs as restrictive for
select
  to authenticated using (history_hidden_at is null);

create function public.hide_recipe_job (target_job_id uuid, actor_id uuid) returns void language plpgsql security invoker
set
  search_path = '' as $$
declare job public.recipe_jobs;
begin
  select j.* into job
  from public.recipe_jobs j
  where j.id = target_job_id and j.user_id = actor_id
    and exists (
      select 1 from public.fridge_members m
      where m.fridge_id = j.fridge_id and m.user_id = actor_id
    )
  for update;

  if not found then
    raise sqlstate 'PT404';
  end if;
  if job.status in ('queued', 'running') then
    raise sqlstate 'PT409';
  end if;
  if job.history_hidden_at is null then
    update public.recipe_jobs set history_hidden_at = now() where id = job.id;
  end if;
end;
$$;

revoke all on function public.hide_recipe_job (uuid, uuid)
from
  public,
  anon,
  authenticated;

grant
execute on function public.hide_recipe_job (uuid, uuid) to service_role;
