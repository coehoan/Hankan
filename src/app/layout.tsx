import type { Metadata } from 'next';
import './globals.css';
import './ui.css';
import {cookies} from 'next/headers';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {ThemeProvider,ThemeSelector} from '@/features/shell/theme-provider';
import {isThemePreference} from '@/features/shell/theme';

export const metadata:Metadata={title:{default:'한칸 · 신선한 냉장고의 시작',template:'%s · 한칸'},description:'식재료와 유통기한을 함께 관리하고, 남은 재료로 오늘의 한 끼를 찾아보세요.'};

export default async function RootLayout({children}:{children:React.ReactNode}){
 const jar=await cookies(),client=await createServerSupabaseClient();
 const {data}=await client.auth.getClaims();const userId=data?.claims.sub;
 const saved=userId?(await client.from('profiles').select('theme_preference').eq('user_id',userId).maybeSingle()).data?.theme_preference:jar.get('hankan-theme')?.value;
 const preference=isThemePreference(saved)?saved:'system';
 return <html lang="ko" data-theme={preference} suppressHydrationWarning><body><ThemeProvider key={userId??'guest'} userId={userId} initialPreference={preference}><div className="theme-toolbar"><ThemeSelector/></div>{children}</ThemeProvider></body></html>;
}
