-- Signed upload capabilities bypass the web function's payload limit.
-- No anon/authenticated object policies: server-issued, insert-only capabilities only.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('receipt-uploads','receipt-uploads',false,10485760,array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
