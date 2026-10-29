create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  local_time text not null default '09:00' check (local_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  timezone text not null default 'Asia/Seoul',
  next_run_at timestamptz,
  last_sent_local_date date,
  updated_at timestamptz not null default now(),
  check (
    enabled
    or next_run_at is null
  )
);

create index notification_preferences_due_idx on public.notification_preferences (next_run_at)
where
  enabled;

create function private.next_notification_at (
  current_at timestamptz,
  zone text,
  at_clock text,
  last_sent date
) returns timestamptz language plpgsql stable
set
  search_path = '' as $$
declare day date; next_at timestamptz;
begin
 if current_at is null or not isfinite(current_at) or zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=zone)
 or at_clock is null or at_clock !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid notification schedule' using errcode='22023'; end if;
 day := (current_at at time zone zone)::date;
 if last_sent is not null and last_sent>=day then day:=last_sent+1; end if;
 next_at := (day+at_clock::time) at time zone zone;
 if next_at<=current_at then next_at:=((day+1)+at_clock::time) at time zone zone; end if;
 return next_at;
end;
$$;

create function private.refresh_notification_schedule () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Invalid timezone' using errcode='22023'; end if;
 new.next_run_at:=case when new.enabled then private.next_notification_at(clock_timestamp(),new.timezone,new.local_time,new.last_sent_local_date) else null end;
 new.updated_at:=clock_timestamp();
 return new;
end;
$$;

create trigger notification_preferences_schedule
before insert or update on public.notification_preferences for each row
execute function private.refresh_notification_schedule ();

insert into
  public.notification_preferences (user_id, timezone)
select
  user_id,
  timezone
from
  public.profiles;

create function private.bootstrap_notification_preferences () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
 insert into public.notification_preferences(user_id,timezone) values(new.user_id,new.timezone);
 return new;
end;
$$;

create trigger profiles_notification_preferences
after insert on public.profiles for each row
execute function private.bootstrap_notification_preferences ();

create function private.sync_notification_timezone () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
 update public.notification_preferences set timezone=new.timezone where user_id=new.user_id;
 return new;
end;
$$;

create trigger profiles_notification_timezone
after update of timezone on public.profiles for each row when (old.timezone is distinct from new.timezone)
execute function private.sync_notification_timezone ();

create function public.save_notification_preferences (input jsonb) returns public.notification_preferences language plpgsql security definer
set
  search_path = '' as $$
declare actor uuid:=auth.uid(); result public.notification_preferences;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if input is null or jsonb_typeof(input)<>'object' then raise exception 'Invalid preferences' using errcode='22023'; end if;
 if (select count(*) from jsonb_object_keys(input))<>2 or not(input ? 'enabled' and input ? 'localTime')
 or jsonb_typeof(input->'enabled')<>'boolean' or jsonb_typeof(input->'localTime')<>'string'
 or input->>'localTime' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid preferences' using errcode='22023'; end if;
 update public.notification_preferences p set enabled=(input->>'enabled')::boolean,local_time=input->>'localTime',timezone=f.timezone
 from public.profiles f where p.user_id=actor and f.user_id=actor returning p.* into result;
 if not found then raise exception 'Preferences unavailable' using errcode='P0002'; end if;
 return result;
end;
$$;

alter table public.notification_preferences enable row level security;

revoke all on public.notification_preferences
from
  anon,
  authenticated;

grant
select
  on public.notification_preferences to authenticated;

grant all on public.notification_preferences to service_role;

create policy notification_preferences_self_read on public.notification_preferences for
select
  to authenticated using (
    user_id = (
      select
        auth.uid ()
    )
  );

revoke all on function private.next_notification_at (timestamptz, text, text, date),
private.refresh_notification_schedule (),
private.bootstrap_notification_preferences (),
private.sync_notification_timezone ()
from
  public,
  anon,
  authenticated;

revoke all on function public.save_notification_preferences (jsonb)
from
  public,
  anon;

grant
execute on function public.save_notification_preferences (jsonb) to authenticated;
