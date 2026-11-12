'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { preferenceResponse } from '@/features/notifications/contracts';

export function RecipeJobStatus({ hasResults }: { hasResults: boolean }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let controller: AbortController | undefined;
    async function load() {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      try {
        const response = await fetch('/api/settings/notifications', {
          cache: 'no-store',
          signal: current.signal,
        });
        const json = await response.json();
        const parsed = preferenceResponse.safeParse(json.data);
        if (!current.signal.aborted)
          setEnabled(response.ok && parsed.success ? parsed.data.enabled : null);
      } catch {
        if (!current.signal.aborted) setEnabled(null);
      }
    }
    const refresh = () => void load();
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      controller?.abort();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, []);
  return (
    <div className="recipe-job-status" role="status">
      <strong>
        {hasResults ? '먼저 준비된 요리부터 확인해 보세요' : '요리를 추천하고 있어요'}
      </strong>
      <p>결과는 추천 내역에 저장돼요. 알림을 켜 두면 완료 소식도 받아요.</p>
      {enabled === false && (
        <Link className="secondary-button recipe-notification-link" href="/mypage#notifications">
          알림 설정하기 <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
