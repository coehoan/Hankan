'use client';
import { useState } from 'react';
import { ThemeSelector } from './theme-provider';
import { PasswordDialog } from '@/features/auth/password-dialog';
import { NotificationSettingsForm } from '@/features/notifications/settings-form';

export function MyPage({ onAccessLost }: { onAccessLost: () => void }) {
  const [passwordOpen, setPasswordOpen] = useState(false),
    [notice, setNotice] = useState('');
  function openPassword() {
    setNotice('');
    setPasswordOpen(true);
  }
  return (
    <main className="my-page">
      <header className="my-page-heading">
        <h1>마이페이지</h1>
        <p>내 계정과 알림을 관리해요.</p>
      </header>
      <section className="my-page-card">
        <h2>화면 설정</h2>
        <ThemeSelector />
      </section>
      <section className="my-page-card">
        <h2>계정 관리</h2>
        <div
          className="settings-row account-password-row"
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          onClick={openPassword}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openPassword();
            }
          }}
        >
          <span>비밀번호 변경</span>
          <span aria-hidden="true">›</span>
        </div>
        {notice && (
          <p role="status" className="notification-success">
            {notice}
          </p>
        )}
      </section>
      <section id="notifications" className="my-page-card" aria-labelledby="my-page-notifications">
        <h2 id="my-page-notifications">알림</h2>
        <NotificationSettingsForm onAccessLost={onAccessLost} />
      </section>
      {passwordOpen && (
        <PasswordDialog
          onClose={() => setPasswordOpen(false)}
          onComplete={() => {
            setPasswordOpen(false);
            setNotice('비밀번호를 변경했어요.');
          }}
        />
      )}
    </main>
  );
}
