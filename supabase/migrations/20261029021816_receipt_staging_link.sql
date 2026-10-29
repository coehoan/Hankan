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

-- Preserve the two-argument RPC for legacy uploads. The required third argument
-- gives direct uploads an atomic creation/link transaction without overload ambiguity.
create function public.create_receipt_draft(draft_id uuid,target_fridge_id uuid,staged_upload_path text)
returns public.receipt_drafts
language plpgsql security definer set search_path='' as $$
declare created public.receipt_drafts;
begin
 if staged_upload_path is null then raise exception 'Upload path required' using errcode='22023';end if;
 select * into created from public.create_receipt_draft(draft_id,target_fridge_id);
 update public.receipt_drafts set staged_object_path=staged_upload_path where id=created.id returning * into created;
 return created;
end;$$;
revoke all on function public.create_receipt_draft(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.create_receipt_draft(uuid,uuid,text) to authenticated;
