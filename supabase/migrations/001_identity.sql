create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.fridge_role as enum ('owner','member');

create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(char_length(display_name) between 1 and 80),
 timezone text not null default 'Asia/Seoul',
 theme_preference text not null default 'system' check(theme_preference in ('system','light','dark')),
 last_fridge_id uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.fridges (
 id uuid primary key default gen_random_uuid(),
 name text not null default '내 냉장고' check(char_length(btrim(name)) between 1 and 80),
 owner_user_id uuid not null unique references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.fridge_members (
 fridge_id uuid not null references public.fridges(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role public.fridge_role not null default 'member',
 joined_at timestamptz not null default now(),
 primary key(fridge_id,user_id)
);
create index fridge_members_user_id_idx on public.fridge_members(user_id);
create unique index fridge_members_one_owner_idx on public.fridge_members(fridge_id) where role='owner';
alter table public.profiles add constraint profiles_last_fridge_id_fkey foreign key(last_fridge_id) references public.fridges(id) on delete set null;

create function private.is_fridge_member(target_fridge_id uuid) returns boolean
language sql stable security definer set search_path=''
as $$select exists(select 1 from public.fridge_members m where m.fridge_id=target_fridge_id and m.user_id=(select auth.uid()))$$;

create function private.is_fridge_owner(target_fridge_id uuid) returns boolean
language sql stable security definer set search_path=''
as $$select exists(select 1 from public.fridges f where f.id=target_fridge_id and f.owner_user_id=(select auth.uid()))$$;

revoke all on function private.is_fridge_member(uuid) from public;
revoke all on function private.is_fridge_owner(uuid) from public;
grant execute on function private.is_fridge_member(uuid),private.is_fridge_owner(uuid) to authenticated;

create function private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now();return new;end;
$$;
create trigger profiles_updated_at before update on public.profiles for each row execute function private.touch_updated_at();
create trigger fridges_updated_at before update on public.fridges for each row execute function private.touch_updated_at();

create function private.validate_profile_selection() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.last_fridge_id is distinct from old.last_fridge_id
    and new.last_fridge_id is not null and auth.uid() is not null
    and not exists(select 1 from public.fridge_members m where m.fridge_id=new.last_fridge_id and m.user_id=auth.uid()) then
  raise exception 'Not a member of selected fridge' using errcode='42501';
 end if;
 return new;
end;
$$;
create trigger profiles_validate_selection before update on public.profiles for each row execute function private.validate_profile_selection();

create function private.bootstrap_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare initial_fridge_id uuid;
begin
 insert into public.profiles(user_id,display_name)
 values(new.id,left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),nullif(split_part(new.email,'@',1),''),'사용자'),80));
 insert into public.fridges(owner_user_id) values(new.id) returning id into initial_fridge_id;
 insert into public.fridge_members(fridge_id,user_id,role) values(initial_fridge_id,new.id,'owner');
 update public.profiles set last_fridge_id=initial_fridge_id where user_id=new.id;
 return new;
end;
$$;
create trigger hankan_auth_user_created after insert on auth.users for each row execute function private.bootstrap_user();

alter table public.profiles enable row level security;
alter table public.fridges enable row level security;
alter table public.fridge_members enable row level security;

revoke all on public.profiles,public.fridges,public.fridge_members from anon,authenticated;
grant select on public.profiles,public.fridges,public.fridge_members to authenticated;
grant update(display_name,theme_preference,last_fridge_id) on public.profiles to authenticated;
grant update(name) on public.fridges to authenticated;
grant all on public.profiles,public.fridges,public.fridge_members to service_role;

create policy profiles_self_read on public.profiles for select to authenticated using(user_id=(select auth.uid()));
create policy profiles_self_update on public.profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy fridges_member_read on public.fridges for select to authenticated using(private.is_fridge_member(id));
create policy fridges_owner_update on public.fridges for update to authenticated using(private.is_fridge_owner(id)) with check(private.is_fridge_owner(id));
create policy fridge_members_member_read on public.fridge_members for select to authenticated using(private.is_fridge_member(fridge_id));

-- Insert/delete and membership changes are reserved for checked RPCs in later stages.
-- The signup trigger creates profile, fridge, and membership in the same transaction.
