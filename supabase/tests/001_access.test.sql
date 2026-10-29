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
  has_table ('public', 'profiles', 'profiles exist');

select
  has_table ('public', 'fridges', 'fridges exist');

select
  has_table ('public', 'fridge_members', 'memberships exist');

insert into
  auth.users (id, email, raw_user_meta_data)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'owner@hankan.test',
    '{}'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'member@hankan.test',
    '{}'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'outsider@hankan.test',
    '{}'
  );

select
  is (
    (
      select
        count(*)
      from
        public.fridges
      where
        owner_user_id = '11111111-1111-4111-8111-111111111111'
    ),
    1::bigint,
    'signup_creates_exactly_one_owned_fridge'
  );

select
  is (
    (
      select
        count(*)
      from
        public.fridge_members
      where
        user_id = '11111111-1111-4111-8111-111111111111'
        and role = 'owner'
    ),
    1::bigint,
    'signup_creates_owner_membership'
  );

select
  ok (
    (
      select
        p.last_fridge_id = f.id
      from
        public.profiles p
        join public.fridges f on f.owner_user_id = p.user_id
      where
        p.user_id = '11111111-1111-4111-8111-111111111111'
    ),
    'initial_selection_is_owned_fridge'
  );

insert into
  public.fridge_members (fridge_id, user_id, role)
select
  id,
  '22222222-2222-4222-8222-222222222222',
  'member'
from
  public.fridges
where
  owner_user_id = '11111111-1111-4111-8111-111111111111';

set
  local role authenticated;

select
  set_config(
    'request.jwt.claims',
    '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
    true
  );

select
  is (
    (
      select
        count(*)
      from
        public.fridges
      where
        owner_user_id = '11111111-1111-4111-8111-111111111111'
    ),
    0::bigint,
    'outsider_cannot_read_fridge'
  );

select
  is (
    (
      select
        count(*)
      from
        public.fridge_members
      where
        user_id = '11111111-1111-4111-8111-111111111111'
    ),
    0::bigint,
    'outsider_cannot_read_members'
  );

select
  is (
    (
      select
        count(*)
      from
        public.profiles
      where
        user_id = '11111111-1111-4111-8111-111111111111'
    ),
    0::bigint,
    'outsider_cannot_read_profile'
  );

select
  throws_ok (
    $$update public.fridge_members set role='owner' where user_id='33333333-3333-4333-8333-333333333333'$$,
    '42501',
    null,
    'direct_role_changes_are_forbidden'
  );

select
  throws_ok (
    $$insert into public.fridge_members(fridge_id,user_id,role) values(gen_random_uuid(),'33333333-3333-4333-8333-333333333333','owner')$$,
    '42501',
    null,
    'cannot_insert_own_membership'
  );

select
  set_config(
    'request.jwt.claims',
    '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
    true
  );

select
  is (
    (
      select
        count(*)
      from
        public.fridges
      where
        owner_user_id = '11111111-1111-4111-8111-111111111111'
    ),
    1::bigint,
    'invited_member_can_read_same_fridge'
  );

select
  is (
    (
      select
        count(*)
      from
        public.fridge_members
      where
        fridge_id = (
          select
            id
          from
            public.fridges
          where
            owner_user_id = '11111111-1111-4111-8111-111111111111'
        )
    ),
    2::bigint,
    'member_can_read_group_members_without_rls_recursion'
  );

select
  is (
    (
      select
        count(*)
      from
        public.profiles
      where
        user_id = '11111111-1111-4111-8111-111111111111'
    ),
    0::bigint,
    'member_cannot_read_owner_private_profile'
  );

select
  throws_ok (
    $$update public.fridge_members set role='owner' where user_id='22222222-2222-4222-8222-222222222222'$$,
    '42501',
    null,
    'member_cannot_promote_self'
  );

with
  changed as (
    update public.fridges
    set
      name = 'hijacked'
    where
      owner_user_id = '11111111-1111-4111-8111-111111111111'
    returning
      id
  )
select
  is (
    (
      select
        count(*)
      from
        changed
    ),
    0::bigint,
    'member_cannot_rename_owners_fridge'
  );

update public.profiles
set
  theme_preference = 'dark'
where
  user_id = '22222222-2222-4222-8222-222222222222';

select
  is (
    (
      select
        theme_preference
      from
        public.profiles
      where
        user_id = '22222222-2222-4222-8222-222222222222'
    ),
    'dark',
    'own_theme_can_be_updated'
  );

select
  throws_ok (
    $$update public.profiles set user_id='11111111-1111-4111-8111-111111111111' where user_id='22222222-2222-4222-8222-222222222222'$$,
    '42501',
    null,
    'profile_ownership_cannot_be_changed'
  );

select
  throws_ok (
    $$update public.fridges set owner_user_id='22222222-2222-4222-8222-222222222222' where owner_user_id='11111111-1111-4111-8111-111111111111'$$,
    '42501',
    null,
    'fridge_ownership_cannot_be_changed'
  );

reset role;

delete from public.fridge_members
where
  user_id = '22222222-2222-4222-8222-222222222222'
  and fridge_id = (
    select
      id
    from
      public.fridges
    where
      owner_user_id = '11111111-1111-4111-8111-111111111111'
  );

set
  local role authenticated;

select
  set_config(
    'request.jwt.claims',
    '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
    true
  );

select
  is (
    (
      select
        count(*)
      from
        public.fridges
      where
        owner_user_id = '11111111-1111-4111-8111-111111111111'
    ),
    0::bigint,
    'revoked_member_loses_access_immediately'
  );

select
  is (
    (
      select
        count(*)
      from
        public.fridges
      where
        owner_user_id = '22222222-2222-4222-8222-222222222222'
    ),
    1::bigint,
    'personal_fridge_remains_after_revocation'
  );

reset role;

set
  local role anon;

select
  throws_ok (
    'select * from public.fridges',
    '42501',
    null,
    'anonymous_cannot_read_fridges'
  );

select
  throws_ok (
    'select * from public.profiles',
    '42501',
    null,
    'anonymous_cannot_read_profiles'
  );

reset role;

select
  *
from
  finish ();

rollback;
