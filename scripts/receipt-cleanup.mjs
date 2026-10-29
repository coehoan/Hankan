import { createClient } from '@supabase/supabase-js';
try {
  process.loadEnvFile('.env.local');
} catch {
  /* Deployment supplies environment directly. */
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Receipt cleanup server configuration missing');
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let running = false;
async function clean() {
  if (running) return;
  running = true;
  try {
    const expired = await client.rpc('expire_receipts');
    if (expired.error) throw new Error('Expiry unavailable');
    const rows = await client
      .from('receipt_drafts')
      .select('id,object_path')
      .eq('cleanup_pending', true)
      .limit(100);
    if (rows.error) throw new Error('Cleanup unavailable');
    let cleaned = 0;
    for (const row of rows.data) {
      const result = await client.storage.from('receipt-originals').remove([row.object_path]);
      if (!result.error) {
        const update = await client
          .from('receipt_drafts')
          .update({ cleanup_pending: false })
          .eq('id', row.id);
        if (!update.error) cleaned++;
      }
    }
    console.log('Receipt cleanup:', cleaned, 'cleaned,', rows.data.length - cleaned, 'pending');
  } catch {
    console.error('Receipt cleanup failed; pending files will be retried.');
    if (process.argv.includes('--once')) process.exitCode = 1;
  } finally {
    running = false;
  }
}
await clean();
if (!process.argv.includes('--once')) setInterval(() => void clean(), 15 * 60 * 1000);
