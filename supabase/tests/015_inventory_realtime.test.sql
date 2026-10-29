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
  has_function (
    'private',
    'broadcast_inventory_change',
    array[]::text[],
    'inventory broadcast trigger function exists'
  );

select
  has_trigger (
    'public',
    'ingredients',
    'ingredients_realtime_changed',
    'ingredient changes broadcast'
  );

select
  has_trigger (
    'public',
    'fridge_members',
    'fridge_members_realtime_changed',
    'membership changes invalidate connected clients'
  );

select
  ok (
    exists (
      select
        1
      from
        pg_policies
      where
        schemaname = 'realtime'
        and tablename = 'messages'
        and policyname = 'inventory_members_receive'
        and cmd = 'SELECT'
    ),
    'private inventory subscriptions have a receive policy'
  );

select
  ok (
    not exists (
      select
        1
      from
        pg_policies
      where
        schemaname = 'realtime'
        and tablename = 'messages'
        and cmd in ('INSERT', 'ALL')
        and 'authenticated' = any (roles)
    ),
    'authenticated clients cannot publish broadcasts'
  );

select
  ok (
    not has_function_privilege(
      'authenticated',
      'private.broadcast_inventory_change()',
      'EXECUTE'
    ),
    'clients cannot invoke the broadcast trigger'
  );

insert into
  auth.users (id, email, raw_user_meta_data)
values
  (
    '17171717-1717-4717-8717-171717171717',
    'realtime-owner@hankan.test',
    '{}'
  ),
  (
    '28282828-2828-4828-8828-282828282828',
    'realtime-member@hankan.test',
    '{}'
  ),
  (
    '39393939-3939-4939-8939-393939393939',
    'realtime-outsider@hankan.test',
    '{}'
  );

select
  set_config(
    'hankan.realtime_fridge',
    (
      select
        id::text
      from
        public.fridges
      where
        owner_user_id = '17171717-1717-4717-8717-171717171717'
    ),
    true
  );

insert into
  public.fridge_members (fridge_id, user_id, role)
values
  (
    current_setting('hankan.realtime_fridge')::uuid,
    '28282828-2828-4828-8828-282828282828',
    'member'
  );

select
  set_config(
    'realtime.topic',
    'fridge:' || current_setting('hankan.realtime_fridge') || ':inventory',
    true
  );

select
  realtime.send (
    '{}',
    'inventory_changed',
    current_setting('realtime.topic'),
    true
  );

set
  local role authenticated;

select
  set_config(
    'request.jwt.claims',
    '{"sub":"17171717-1717-4717-8717-171717171717","role":"authenticated"}',
    true
  );

select
  ok (
    (
      select
        count(*) > 0
      from
        realtime.messages
      where
        topic = current_setting('realtime.topic')
    ),
    'owner can receive private inventory messages'
  );

select
  set_config(
    'request.jwt.claims',
    '{"sub":"28282828-2828-4828-8828-282828282828","role":"authenticated"}',
    true
  );

select
  ok (
    (
      select
        count(*) > 0
      from
        realtime.messages
      where
        topic = current_setting('realtime.topic')
    ),
    'member can receive private inventory messages'
  );

select
  throws_ok (
    $$insert into realtime.messages(topic,extension,payload,event,private) values(current_setting('realtime.topic'),'broadcast','{}','inventory_changed',true)$$,
    '42501',
    null,
    'members cannot send forged invalidations'
  );

select
  set_config(
    'request.jwt.claims',
    '{"sub":"39393939-3939-4939-8939-393939393939","role":"authenticated"}',
    true
  );

select
  is (
    (
      select
        count(*)
      from
        realtime.messages
      where
        topic = current_setting('realtime.topic')
    ),
    0::bigint,
    'outsider cannot receive shared inventory messages'
  );

select
  set_config(
    'request.jwt.claims',
    '{"sub":"17171717-1717-4717-8717-171717171717","role":"authenticated"}',
    true
  );

select
  set_config(
    'realtime.topic',
    'fridge:not-a-uuid:inventory',
    true
  );

select
  is (
    (
      select
        count(*)
      from
        realtime.messages
    ),
    0::bigint,
    'malformed topics are denied without UUID cast errors'
  );

reset role;

select
  *
from
  finish ();

rollback;
