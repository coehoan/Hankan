import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { serverSupabaseConfig } from '@/lib/supabase/server-config';
import type { Database } from '@/lib/supabase/database.types';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key, cookieName } = serverSupabaseConfig();
  const client = createServerClient<Database>(url, key, {
    cookieOptions: { name: cookieName },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values) response.cookies.set(name, value, options);
      },
    },
  });
  await client.auth.getClaims();
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  if (
    request.nextUrl.pathname.startsWith('/invite/') ||
    request.nextUrl.pathname.startsWith('/api/invites/')
  )
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
