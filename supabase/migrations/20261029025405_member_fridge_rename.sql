create or replace function public.rename_fridge(target_fridge_id uuid,fridge_name text)
returns public.fridges language plpgsql security definer set search_path='' as $$
declare cleaned text; renamed public.fridges;
begin
 -- Match member removal/leave lock order, then recheck membership after waiting.
 perform 1 from public.fridges where id=target_fridge_id for update;
 perform private.lock_inventory_membership(target_fridge_id);
 cleaned:=btrim(fridge_name);
 if cleaned is null or char_length(cleaned) not between 1 and 80 or cleaned ~ '[[:cntrl:]]' then
  raise exception 'Invalid fridge name' using errcode='22023';
 end if;
 update public.fridges set name=cleaned where id=target_fridge_id returning * into renamed;
 if not found then raise exception 'Fridge unavailable' using errcode='P0002';end if;
 return renamed;
end;$$;
revoke all on function public.rename_fridge(uuid,text) from public,anon,authenticated;
grant execute on function public.rename_fridge(uuid,text) to authenticated;
