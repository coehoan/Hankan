create table public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique,
 p256dh text not null,
 auth text not null,
 created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon,authenticated;
grant select(id,user_id,endpoint,created_at) on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
create policy push_self_read on public.push_subscriptions for select to authenticated using(user_id=(select auth.uid()));

create function public.save_push_subscription(input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result uuid; address text:=input->>'endpoint';
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 -- Limit dispatch to known browser push services; never fetch arbitrary client URLs.
 if length(address)>4096 or address !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|([a-z0-9-]+\.)*(notify|wns)\.windows\.com)/[^#[:space:]]+$'
 or address is null or coalesce(input->'keys'->>'p256dh','') !~ '^B[A-Za-z0-9_-]{86}=?$'
 or coalesce(input->'keys'->>'auth','') !~ '^[A-Za-z0-9_-]{22}(==)?$' then
  raise exception 'Invalid push subscription' using errcode='22023';
 end if;
 if not exists(select 1 from public.notification_preferences where user_id=actor and enabled) then raise exception 'Enable schedule first' using errcode='22023'; end if;
 insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values(actor,address,input->'keys'->>'p256dh',input->'keys'->>'auth')
 on conflict(endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth where push_subscriptions.user_id=actor
 returning id into result;
 if result is null then raise exception 'Subscription belongs to another user' using errcode='23505'; end if;
 return result;
end;
$$;
create function public.delete_push_subscription(subscription_id uuid) returns void
language sql security definer set search_path='' as $$
 delete from public.push_subscriptions where id=subscription_id and user_id=auth.uid();
$$;
revoke all on function public.save_push_subscription(jsonb),public.delete_push_subscription(uuid) from public,anon;
grant execute on function public.save_push_subscription(jsonb),public.delete_push_subscription(uuid) to authenticated;

create function private.clear_disabled_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not new.enabled then delete from public.push_subscriptions where user_id=new.user_id; end if;
 return new;
end;
$$;
create trigger notification_disable_push after update of enabled on public.notification_preferences for each row execute function private.clear_disabled_push();
revoke all on function private.clear_disabled_push() from public,anon,authenticated;
