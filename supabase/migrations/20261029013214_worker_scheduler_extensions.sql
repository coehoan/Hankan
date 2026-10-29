-- Operational scheduler only; no public tables, grants or user data changes.
create extension if not exists pg_cron;

create extension if not exists pg_net
with
  schema extensions;
