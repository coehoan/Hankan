create table public.fridge_invites (
  id uuid primary key default gen_random_uuid(),
  fridge_id uuid not null references public.fridges (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz
);

create index fridge_invites_fridge_created_idx on public.fridge_invites (fridge_id, created_at desc);

alter table public.fridge_invites enable row level security;

revoke all on public.fridge_invites
from
  anon,
  authenticated;

grant
select
  (
    id,
    fridge_id,
    created_at,
    expires_at,
    used_at,
    revoked_at
  ) on public.fridge_invites to authenticated;

grant all on public.fridge_invites to service_role;

create policy fridge_invites_owner_read on public.fridge_invites for
select
  to authenticated using (private.is_fridge_owner (fridge_id));

create function private.lock_owned_fridge (target_fridge_id uuid) returns uuid language plpgsql security definer
set
  search_path = '' as $$
declare actor uuid := auth.uid();
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform 1 from public.fridges f where f.id=target_fridge_id and f.owner_user_id=actor for update;
 if not found then raise exception 'Owner access required' using errcode='42501'; end if;
 return actor;
end;
$$;

create function public.create_fridge_invite (target_fridge_id uuid, token_digest text) returns table (invite_id uuid, expires_at timestamptz) language plpgsql security definer
set
  search_path = '' as $$
declare actor uuid; created timestamptz := clock_timestamp();
begin
 actor := private.lock_owned_fridge(target_fridge_id);
 if token_digest is null or token_digest !~ '^[0-9a-f]{64}$' then raise exception 'Invalid digest' using errcode='22023'; end if;
 return query insert into public.fridge_invites(fridge_id,token_hash,created_by,created_at,expires_at)
 values(target_fridge_id,token_digest,actor,created,created+interval '168 hours') returning fridge_invites.id,fridge_invites.expires_at;
end;
$$;

create function public.inspect_fridge_invite (token_digest text) returns table (
  fridge_id uuid,
  fridge_name text,
  role public.fridge_role,
  state text
) language plpgsql security definer
set
  search_path = '' as $$
declare invitation public.fridge_invites; label text; status text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into invitation from public.fridge_invites i where i.token_hash=token_digest;
 if not found then raise exception 'Invitation not found' using errcode='P0002'; end if;
 select f.name into label from public.fridges f where f.id=invitation.fridge_id;
 status := case
  when exists(select 1 from public.fridge_members m where m.fridge_id=invitation.fridge_id and m.user_id=auth.uid()) then 'already_member'
  when invitation.revoked_at is not null then 'revoked'
  when invitation.used_at is not null then 'used'
  when invitation.expires_at<=clock_timestamp() then 'expired'
  else 'valid' end;
 return query select invitation.fridge_id,label,'member'::public.fridge_role,status;
end;
$$;

create function public.accept_fridge_invite (token_digest text) returns table (id uuid, name text, role public.fridge_role) language plpgsql security definer
set
  search_path = '' as $$
declare actor uuid := auth.uid(); invitation public.fridge_invites; fridge public.fridges;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into invitation from public.fridge_invites i where i.token_hash=token_digest;
 if not found then raise exception 'Invitation not found' using errcode='P0002'; end if;
 -- All sharing mutations acquire the fridge lock before invite/member locks.
 select * into fridge from public.fridges f where f.id=invitation.fridge_id for update;
 if not found then raise exception 'Invitation not found' using errcode='P0002'; end if;
 select * into invitation from public.fridge_invites i where i.token_hash=token_digest for update;
 if fridge.owner_user_id=actor then raise exception 'Owner cannot join own fridge' using errcode='42501'; end if;
 if exists(select 1 from public.fridge_members m where m.fridge_id=fridge.id and m.user_id=actor) then
  return query select fridge.id,fridge.name,'member'::public.fridge_role;return;
 end if;
 if invitation.revoked_at is not null or invitation.used_at is not null or invitation.expires_at<=clock_timestamp() then
  raise exception 'Invitation unavailable' using errcode='PT409';
 end if;
 insert into public.fridge_members(fridge_id,user_id,role) values(fridge.id,actor,'member');
 update public.fridge_invites i set used_at=clock_timestamp(),used_by=actor where i.id=invitation.id;
 update public.profiles p set last_fridge_id=fridge.id where p.user_id=actor;
 return query select fridge.id,fridge.name,'member'::public.fridge_role;
end;
$$;

create function public.revoke_fridge_invite (target_fridge_id uuid, invite_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
declare invitation public.fridge_invites;
begin
 perform private.lock_owned_fridge(target_fridge_id);
 select * into invitation from public.fridge_invites i where i.id=invite_id and i.fridge_id=target_fridge_id for update;
 if not found then raise exception 'Invitation not found' using errcode='P0002'; end if;
 if invitation.used_at is not null then raise exception 'Invitation already used' using errcode='PT409'; end if;
 update public.fridge_invites i set revoked_at=coalesce(i.revoked_at,clock_timestamp()) where i.id=invitation.id;
end;
$$;

create function public.list_fridge_members (target_fridge_id uuid) returns table (
  user_id uuid,
  display_name text,
  role public.fridge_role
) language plpgsql security definer
set
  search_path = '' as $$
begin
 perform private.lock_inventory_membership(target_fridge_id);
 return query select m.user_id,p.display_name,m.role from public.fridge_members m join public.profiles p on p.user_id=m.user_id
 where m.fridge_id=target_fridge_id order by case when m.role='owner' then 0 else 1 end,m.joined_at,m.user_id;
end;
$$;

create function public.remove_fridge_member (target_fridge_id uuid, member_user_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
declare actor uuid;
begin
 actor := private.lock_owned_fridge(target_fridge_id);
 if member_user_id=actor then raise exception 'Owner cannot be removed' using errcode='42501'; end if;
 delete from public.fridge_members m where m.fridge_id=target_fridge_id and m.user_id=member_user_id and m.role='member';
end;
$$;

create function public.leave_fridge (target_fridge_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
declare actor uuid := auth.uid(); fridge public.fridges;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into fridge from public.fridges f where f.id=target_fridge_id for update;
 if not found then raise exception 'Fridge not found' using errcode='P0002'; end if;
 if fridge.owner_user_id=actor then raise exception 'Owner cannot leave' using errcode='42501'; end if;
 delete from public.fridge_members m where m.fridge_id=target_fridge_id and m.user_id=actor and m.role='member';
end;
$$;

revoke all on function private.lock_owned_fridge (uuid)
from
  public,
  anon,
  authenticated;

revoke all on function public.create_fridge_invite (uuid, text),
public.inspect_fridge_invite (text),
public.accept_fridge_invite (text),
public.revoke_fridge_invite (uuid, uuid),
public.list_fridge_members (uuid),
public.remove_fridge_member (uuid, uuid),
public.leave_fridge (uuid)
from
  public,
  anon,
  authenticated;

grant
execute on function public.create_fridge_invite (uuid, text),
public.inspect_fridge_invite (text),
public.accept_fridge_invite (text),
public.revoke_fridge_invite (uuid, uuid),
public.list_fridge_members (uuid),
public.remove_fridge_member (uuid, uuid),
public.leave_fridge (uuid) to authenticated;
