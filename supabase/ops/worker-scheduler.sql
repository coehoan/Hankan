-- Run once after migrations; leaves the job INACTIVE until production verification.
-- Values stay inside Vault; the scheduled command contains secret names only.
select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'hankan_worker_secret','Vercel worker request authentication')
where not exists(select 1 from vault.secrets where name='hankan_worker_secret');
select vault.create_secret('https://hankan-murex.vercel.app/api/internal/worker','hankan_worker_url','Verified production worker endpoint')
where not exists(select 1 from vault.secrets where name='hankan_worker_url');
select cron.schedule('hankan-worker-every-minute','* * * * *',$job$
select net.http_post(
 url:=(select decrypted_secret from vault.decrypted_secrets where name='hankan_worker_url'),
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='hankan_worker_secret')),
 body:='{}'::jsonb,timeout_milliseconds:=300000);
$job$);
select cron.alter_job((select jobid from cron.job where jobname='hankan-worker-every-minute'),active:=false);
