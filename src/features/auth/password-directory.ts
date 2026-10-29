import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { serverSupabaseConfig } from '@/lib/supabase/server-config';
import type { PasswordDirectory } from './admin-reset';
export function createPasswordDirectory(): PasswordDirectory {
  const admin = createAdminSupabaseClient();
  return {
    async list(page) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error('계정 목록을 확인하지 못했어요.');
      return {
        users: data.users.map((u) => ({ id: u.id, email: u.email })),
        hasMore: data.users.length === 200,
      };
    },
    async setPassword(id, password) {
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) throw new Error('비밀번호를 초기화하지 못했어요.');
    },
    async revokeSessions(email, password) {
      const { url, key } = serverSupabaseConfig(),
        client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
      const login = await client.auth.signInWithPassword({ email, password });
      if (login.error) throw new Error('비밀번호는 초기화했지만 세션 정리에 실패했어요.');
      const { error } = await client.auth.signOut({ scope: 'global' });
      if (error) throw new Error('비밀번호는 초기화했지만 세션 정리에 실패했어요.');
    },
  };
}
