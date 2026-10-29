'use client';
import Link from 'next/link';
import {ThemeSelector} from './theme-provider';
import {SignOutButton} from '@/features/auth/sign-out-button';
import {NotificationSettingsForm} from '@/features/notifications/settings-form';

export function MyPage({onAccessLost}:{onAccessLost:()=>void}){
 return <main className="my-page"><header className="my-page-heading"><h1>마이페이지</h1><p>내 계정과 알림을 관리해요.</p></header>
  <section className="my-page-card"><h2>화면 설정</h2><ThemeSelector/></section>
  <section className="my-page-card"><h2>계정 관리</h2><div className="my-page-actions"><Link className="secondary-button" href="/change-password">비밀번호 변경</Link></div></section>
  <section id="notifications" className="my-page-card" aria-labelledby="my-page-notifications"><h2 id="my-page-notifications">알림</h2><NotificationSettingsForm onAccessLost={onAccessLost}/></section>
  <div className="my-page-logout"><SignOutButton/></div>
 </main>;
}
