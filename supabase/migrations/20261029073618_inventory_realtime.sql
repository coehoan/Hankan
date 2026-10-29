-- Private invalidations contain no ingredient/member values. The GET API rechecks access.
create policy inventory_members_receive on realtime.messages for
select
  to authenticated using (
    extension = 'broadcast'
    and exists (
      select
        1
      from
        public.fridge_members m
      where
        m.user_id = (
          select
            auth.uid ()
        )
        and (
          select
            realtime.topic ()
        ) = 'fridge:' || m.fridge_id::text || ':inventory'
    )
  );

create function private.broadcast_inventory_change () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare target_fridge_id uuid;
begin
  if TG_OP = 'DELETE' then target_fridge_id := OLD.fridge_id;
  else target_fridge_id := NEW.fridge_id;
  end if;
  perform realtime.send('{}'::jsonb, 'inventory_changed', 'fridge:' || target_fridge_id::text || ':inventory', true);
  return null;
end;
$$;

revoke all on function private.broadcast_inventory_change ()
from
  public,
  anon,
  authenticated;

create trigger ingredients_realtime_changed
after insert or update or delete on public.ingredients for each row
execute function private.broadcast_inventory_change ();

-- Cached Realtime authorization can outlive membership; prompt an API recheck on removal.
create trigger fridge_members_realtime_changed
after insert or update or delete on public.fridge_members for each row
execute function private.broadcast_inventory_change ();
