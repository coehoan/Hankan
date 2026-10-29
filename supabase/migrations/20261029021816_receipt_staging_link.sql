alter table public.receipt_drafts add column staged_object_path text;
alter table public.receipt_drafts add constraint receipt_staged_path_owned check (
 staged_object_path is null or (
  length(staged_object_path)=110
  and left(staged_object_path,74)=user_id::text||'_'||fridge_id::text||'_'
  and substring(staged_object_path from 75) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 )
);
create index receipt_staged_terminal_idx on public.receipt_drafts(created_at)
where staged_object_path is not null and status in ('saved','cancelled');
