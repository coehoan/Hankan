begin;

select
  plan (6);

select
  has_table (
    'public',
    'push_subscriptions',
    'push subscriptions exist'
  );

select
  has_table (
    'public',
    'notification_jobs',
    'notification jobs exist'
  );

select
  has_table (
    'public',
    'notification_deliveries',
    'notification deliveries exist'
  );

select
  ok (
    not has_function_privilege(
      'authenticated',
      'public.claim_notification_jobs(timestamptz,integer)',
      'EXECUTE'
    ),
    'no client claim'
  );

select
  ok (
    not has_table_privilege(
      'authenticated',
      'public.notification_jobs',
      'SELECT'
    ),
    'no job read'
  );

select
  ok (
    not has_table_privilege(
      'authenticated',
      'public.push_subscriptions',
      'INSERT'
    ),
    'checked registration only'
  );

select
  *
from
  finish ();

rollback;
