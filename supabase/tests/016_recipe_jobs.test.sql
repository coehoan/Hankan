begin;

create extension if not exists pgtap
with
  schema extensions;

set
  local search_path = public,
  extensions;

select
  no_plan ();

select
  has_table (
    'public',
    'recipe_jobs',
    'durable recipe queue exists'
  );

select
  has_table (
    'public',
    'recipe_job_requests',
    'accepted request aliases persist'
  );

select
  ok (
    (
      select
        relrowsecurity
      from
        pg_class
      where
        oid = 'public.recipe_jobs'::regclass
    ),
    'recipe jobs enforce RLS'
  );

select
  ok (
    (
      select
        relrowsecurity
      from
        pg_class
      where
        oid = 'public.recipe_job_requests'::regclass
    ),
    'request aliases enforce RLS'
  );

select
  ok (
    not has_table_privilege('anon', 'public.recipe_jobs', 'SELECT'),
    'anonymous cannot read recipe jobs'
  );

select
  ok (
    not has_table_privilege('authenticated', 'public.recipe_jobs', 'UPDATE'),
    'clients cannot publish recipe jobs'
  );

select
  ok (
    not has_table_privilege(
      'authenticated',
      'public.recipe_job_requests',
      'SELECT'
    ),
    'request aliases stay server-only'
  );

select
  ok (
    has_function_privilege(
      'authenticated',
      'public.enqueue_recipe_job(uuid,uuid,uuid[])',
      'EXECUTE'
    ),
    'members can request recipes'
  );

select
  ok (
    not has_function_privilege(
      'anon',
      'public.enqueue_recipe_job(uuid,uuid,uuid[])',
      'EXECUTE'
    ),
    'anonymous cannot enqueue'
  );

select
  ok (
    not has_function_privilege(
      'authenticated',
      'public.claim_recipe_jobs(uuid)',
      'EXECUTE'
    ),
    'clients cannot claim'
  );

select
  ok (
    not has_function_privilege(
      'authenticated',
      'public.publish_recipe_source(uuid,uuid,text,jsonb,boolean)',
      'EXECUTE'
    ),
    'clients cannot forge results'
  );

select
  ok (
    not has_function_privilege(
      'authenticated',
      'public.claim_recipe_notifications()',
      'EXECUTE'
    ),
    'clients cannot claim completion push'
  );

select
  ok (
    not has_function_privilege(
      'authenticated',
      'public.prepare_recipe_notification(uuid,uuid)',
      'EXECUTE'
    ),
    'clients cannot read push credentials'
  );

select
  *
from
  finish ();

rollback;
