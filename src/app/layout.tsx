import type { Metadata } from 'next';
import './globals.css';
import './ui.css';
import './receipts.css';
import './recipes.css';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ThemeProvider } from '@/features/shell/theme-provider';
import './mobile-settings.css';
import './profile-navigation.css';
import './fridge-invite-controls.css';
import { isThemePreference } from '@/features/shell/theme';
import { PwaProvider } from '@/features/notifications/pwa-provider';

export const metadata: Metadata = {
  title: { default: '한칸 · 신선한 냉장고의 시작', template: '%s · 한칸' },
  description: '식재료와 유통기한을 함께 관리하고, 남은 재료로 오늘의 한 끼를 찾아보세요.',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '한칸' },
  icons: { apple: '/icons/icon-192.png' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies(),
    client = await createServerSupabaseClient();
  const { data } = await client.auth.getClaims();
  const userId = data?.claims.sub;
  const saved = userId
    ? (await client.from('profiles').select('theme_preference').eq('user_id', userId).maybeSingle())
        .data?.theme_preference
    : jar.get('hankan-theme')?.value;
  const preference = isThemePreference(saved) ? saved : 'system';
  return (
    <html lang="ko" data-theme={preference} suppressHydrationWarning>
      <body>
        <ThemeProvider key={userId ?? 'guest'} userId={userId} initialPreference={preference}>
          <PwaProvider key={userId ?? 'guest'} userId={userId} />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
