-- Whitespace matches ECMAScript String.trim, including Korean full-width spaces.
create function private.ingredient_whitespace() returns text
language sql immutable set search_path='' as $$
 select U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
$$;

create function private.clean_ingredient_name(value text) returns text
language plpgsql immutable set search_path='' as $$
declare cleaned text := btrim(value,private.ingredient_whitespace());
begin
 if cleaned is null or char_length(cleaned) not between 1 and 80 then
  raise exception 'Invalid ingredient name' using errcode='22023';
 end if;
 return cleaned;
end;
$$;

create function private.normalize_ingredient_name(value text) returns text
language sql immutable set search_path='' as $$
 select lower(regexp_replace(value,'['||private.ingredient_whitespace()||']+',' ','g'))
$$;

create function private.ingredient_date(value text) returns date
language plpgsql immutable set search_path='' as $$
begin
 if value is null or value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or left(value,4)='0000' then
  raise exception 'Invalid ingredient date' using errcode='22023';
 end if;
 return value::date;
exception when datetime_field_overflow or invalid_datetime_format then
 raise exception 'Invalid ingredient date' using errcode='22023';
end;
$$;

create table public.ingredients (
 id uuid primary key default gen_random_uuid(),
 fridge_id uuid not null references public.fridges(id) on delete cascade,
 name text not null check(name=private.clean_ingredient_name(name)),
 normalized_name text generated always as (private.normalize_ingredient_name(name)) stored,
 storage text not null check(storage in ('fridge','freezer','pantry')),
 expires_on date not null check(expires_on between date '0001-01-01' and date '9999-12-31'),
 remaining_percent integer not null default 100 check(remaining_percent between 0 and 100 and remaining_percent%5=0),
 version integer not null default 1 check(version>=1),
 -- Audit identifiers survive membership changes; they are always assigned from auth.uid().
 created_by uuid not null,
 updated_by uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
create index ingredients_fridge_expiry_idx on public.ingredients(fridge_id,expires_on,created_at,id);

create table public.ingredient_create_requests (
 fridge_id uuid not null references public.fridges(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 payload jsonb not null,
 -- No FK to ingredients: a retry must remember a batch even after it is deleted.
 ingredient_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(fridge_id,user_id,request_id)
);
alter table public.ingredients enable row level security;
alter table public.ingredient_create_requests enable row level security;
revoke all on public.ingredients,public.ingredient_create_requests from anon,authenticated;
grant select on public.ingredients to authenticated;
grant all on public.ingredients,public.ingredient_create_requests to service_role;
create policy ingredients_member_read on public.ingredients for select to authenticated
 using(private.is_fridge_member(fridge_id));

create function private.lock_inventory_membership(target_fridge_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor_id uuid := auth.uid();
begin
 if actor_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 -- Revocation/departure cannot commit halfway through this mutation.
 perform 1 from public.fridge_members m where m.fridge_id=target_fridge_id and m.user_id=actor_id for share;
 if not found then raise exception 'Fridge access denied' using errcode='42501'; end if;
 return actor_id;
end;
$$;

create function private.validate_ingredient_input(value jsonb,is_patch boolean) returns jsonb
language plpgsql immutable set search_path='' as $$
declare allowed text[]; result jsonb := '{}'; amount numeric;
begin
 if jsonb_typeof(value) is distinct from 'object' or value='{}'::jsonb then
  raise exception 'Invalid ingredient input' using errcode='22023';
 end if;
 allowed := case when is_patch then array['name','storage','expiresOn','remainingPercent'] else array['requestId','name','storage','expiresOn'] end;
 if value-allowed <> '{}'::jsonb then raise exception 'Unknown ingredient fields' using errcode='22023'; end if;
 if not is_patch and not value ?& array['requestId','name','storage','expiresOn'] then
  raise exception 'Missing ingredient fields' using errcode='22023';
 end if;
 if not is_patch then
  if jsonb_typeof(value->'requestId') is distinct from 'string' or (value->>'requestId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
   raise exception 'Invalid creation request' using errcode='22023';
  end if;
 end if;
 if value ? 'name' then
  if jsonb_typeof(value->'name') is distinct from 'string' then raise exception 'Invalid ingredient name' using errcode='22023'; end if;
  result := result||jsonb_build_object('name',private.clean_ingredient_name(value->>'name'));
 end if;
 if value ? 'storage' then
  if jsonb_typeof(value->'storage') is distinct from 'string' or value->>'storage' not in ('fridge','freezer','pantry') then
   raise exception 'Invalid storage place' using errcode='22023';
  end if;
  result := result||jsonb_build_object('storage',value->>'storage');
 end if;
 if value ? 'expiresOn' then
  if jsonb_typeof(value->'expiresOn') is distinct from 'string' then raise exception 'Invalid ingredient date' using errcode='22023'; end if;
  result := result||jsonb_build_object('expiresOn',to_char(private.ingredient_date(value->>'expiresOn'),'YYYY-MM-DD'));
 end if;
 if value ? 'remainingPercent' then
  if jsonb_typeof(value->'remainingPercent') is distinct from 'number' then raise exception 'Invalid remaining amount' using errcode='22023'; end if;
  amount := (value->>'remainingPercent')::numeric;
  if amount<0 or amount>100 or mod(amount,5)<>0 then raise exception 'Invalid remaining amount' using errcode='22023'; end if;
  result := result||jsonb_build_object('remainingPercent',amount::integer);
 end if;
 return result;
end;
$$;

create function public.create_ingredient(target_fridge_id uuid,input jsonb) returns public.ingredients
language plpgsql security definer set search_path='' as $$
declare actor_id uuid; canonical jsonb; request public.ingredient_create_requests; item public.ingredients; inserted integer;
begin
 actor_id := private.lock_inventory_membership(target_fridge_id);
 canonical := private.validate_ingredient_input(input,false);
 insert into public.ingredient_create_requests(fridge_id,user_id,request_id,payload,ingredient_id)
 values(target_fridge_id,actor_id,(input->>'requestId')::uuid,canonical,gen_random_uuid())
 on conflict do nothing;
 get diagnostics inserted = row_count;
 select * into request from public.ingredient_create_requests r
 where r.fridge_id=target_fridge_id and r.user_id=actor_id and r.request_id=(input->>'requestId')::uuid for update;
 if request.payload<>canonical then raise exception 'Creation request already used' using errcode='PT409'; end if;
 if inserted=1 then
  insert into public.ingredients(id,fridge_id,name,storage,expires_on,created_by,updated_by)
  values(request.ingredient_id,target_fridge_id,canonical->>'name',canonical->>'storage',(canonical->>'expiresOn')::date,actor_id,actor_id)
  returning * into item;
 else
  select * into item from public.ingredients i where i.id=request.ingredient_id and i.fridge_id=target_fridge_id;
  if not found then raise exception 'Ingredient no longer exists' using errcode='P0002'; end if;
 end if;
 return item;
end;
$$;

create function public.update_ingredient(target_fridge_id uuid,ingredient_id uuid,expected_version integer,patch jsonb) returns public.ingredients
language plpgsql security definer set search_path='' as $$
declare actor_id uuid; canonical jsonb; item public.ingredients;
begin
 actor_id := private.lock_inventory_membership(target_fridge_id);
 canonical := private.validate_ingredient_input(patch,true);
 if expected_version is null or expected_version<1 then raise exception 'Invalid version' using errcode='22023'; end if;
 select * into item from public.ingredients i where i.id=ingredient_id and i.fridge_id=target_fridge_id for update;
 if not found then raise exception 'Ingredient no longer exists' using errcode='P0002'; end if;
 if item.version<>expected_version then raise exception 'Ingredient changed' using errcode='PT409'; end if;
 if item.version=2147483647 then raise exception 'Version limit reached' using errcode='22023'; end if;
 update public.ingredients i set
  name=case when canonical ? 'name' then canonical->>'name' else i.name end,
  storage=case when canonical ? 'storage' then canonical->>'storage' else i.storage end,
  expires_on=case when canonical ? 'expiresOn' then (canonical->>'expiresOn')::date else i.expires_on end,
  remaining_percent=case when canonical ? 'remainingPercent' then (canonical->>'remainingPercent')::integer else i.remaining_percent end,
  version=i.version+1,updated_by=actor_id,updated_at=clock_timestamp()
 where i.id=item.id returning * into item;
 return item;
end;
$$;

create function public.delete_ingredient(target_fridge_id uuid,ingredient_id uuid,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare item public.ingredients;
begin
 perform private.lock_inventory_membership(target_fridge_id);
 if expected_version is null or expected_version<1 then raise exception 'Invalid version' using errcode='22023'; end if;
 select * into item from public.ingredients i where i.id=ingredient_id and i.fridge_id=target_fridge_id for update;
 if not found then raise exception 'Ingredient no longer exists' using errcode='P0002'; end if;
 if item.version<>expected_version then raise exception 'Ingredient changed' using errcode='PT409'; end if;
 delete from public.ingredients i where i.id=item.id;
end;
$$;

revoke all on function private.ingredient_whitespace(),private.clean_ingredient_name(text),private.normalize_ingredient_name(text),private.ingredient_date(text),private.lock_inventory_membership(uuid),private.validate_ingredient_input(jsonb,boolean) from public,anon,authenticated;
revoke all on function public.create_ingredient(uuid,jsonb),public.update_ingredient(uuid,uuid,integer,jsonb),public.delete_ingredient(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.create_ingredient(uuid,jsonb),public.update_ingredient(uuid,uuid,integer,jsonb),public.delete_ingredient(uuid,uuid,integer) to authenticated;
