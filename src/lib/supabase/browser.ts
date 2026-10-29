import { createBrowserClient } from '@supabase/ssr';
import { publicSupabaseConfig } from '@/lib/env';
import type { Database } from './database.types';

export function createBrowserSupabaseClient() {
  const { url, key } = publicSupabaseConfig();
  return createBrowserClient<Database>(url, key);
}
