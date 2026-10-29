import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { serverSupabaseConfig } from './server-config';
import type { Database } from './database.types';
export function createAdminSupabaseClient() {
  const { url } = serverSupabaseConfig(),
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Server storage configuration missing');
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
