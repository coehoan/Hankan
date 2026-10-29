import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { serverSupabaseConfig } from './server-config';
import type { Database } from './database.types';

export async function createServerSupabaseClient() {
  const jar = await cookies();
  const { url, key, cookieName } = serverSupabaseConfig();
  return createServerClient<Database>(url, key, {
    cookieOptions: { name: cookieName },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        try {
          for (const { name, value, options } of values) jar.set(name, value, options);
        } catch {
          /* Read-only Server Components rely on the proxy to refresh cookies. */
        }
      },
    },
  });
}
