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
    'receipt_drafts',
    'private drafts exist'
  );

select
  has_function (
    'public',
    'commit_receipt',
    array['uuid', 'uuid', 'jsonb'],
    'atomic receipt import exists'
  );

select
  has_function (
    'public',
    'cancel_receipt',
    array['uuid'],
    'owner can cancel and clean'
  );

select
  ok (
    not has_table_privilege('anon', 'public.receipt_drafts', 'SELECT'),
    'anonymous cannot read drafts'
  );

select
  ok (
    not has_table_privilege(
      'authenticated',
      'public.receipt_drafts',
      'INSERT'
    ),
    'direct draft creation denied'
  );

select
  ok (
    not has_function_privilege(
      'authenticated',
      'public.finish_receipt_analysis(uuid,uuid,jsonb,boolean)',
      'EXECUTE'
    ),
    'clients cannot forge analysis completion'
  );

select
  is (
    (
      select
        public
      from
        storage.buckets
      where
        id = 'receipt-originals'
    ),
    false,
    'original bucket is private'
  );

select
  *
from
  finish ();

rollback;
