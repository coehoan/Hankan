-- Existing issued links keep their original expires_at.
create or replace function public.create_fridge_invite (target_fridge_id uuid, token_digest text) returns table (invite_id uuid, expires_at timestamptz) language plpgsql security definer
set
  search_path = '' as $$
declare actor uuid; created timestamptz := clock_timestamp();
begin
 actor := private.lock_owned_fridge(target_fridge_id);
 if token_digest is null or token_digest !~ '^[0-9a-f]{64}$' then raise exception 'Invalid digest' using errcode='22023'; end if;
 return query insert into public.fridge_invites(fridge_id,token_hash,created_by,created_at,expires_at)
 values(target_fridge_id,token_digest,actor,created,created+interval '24 hours') returning fridge_invites.id,fridge_invites.expires_at;
end;
$$;

create or replace function public.clear_fridge_invite_history (target_fridge_id uuid) returns integer language plpgsql security definer
set
  search_path = '' as $$
declare removed integer; cutoff timestamptz;
begin
 perform private.lock_owned_fridge(target_fridge_id);
 cutoff:=clock_timestamp();
 delete from public.fridge_invites i where i.fridge_id=target_fridge_id
 and (i.used_at is not null or i.revoked_at is not null or i.expires_at<=cutoff);
 get diagnostics removed=row_count;
 return removed;
end;$$;

revoke all on function public.clear_fridge_invite_history (uuid)
from
  public,
  anon,
  authenticated;

grant
execute on function public.clear_fridge_invite_history (uuid) to authenticated;

create or replace function public.accept_fridge_invite (token_digest text) returns table (id uuid, name text, role public.fridge_role) language plpgsql security definer
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
 if not found then raise exception 'Invitation not found' using errcode='P0002'; end if;
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
