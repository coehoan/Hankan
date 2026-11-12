'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { RecipeActivityPopup } from '@/features/recipes/recipe-activity';

export function DevelopmentMenu({
  open,
  onOpenChange,
  fallbackFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fallbackFocus: () => HTMLElement | null;
}) {
  const [preview, setPreview] = useState<{ status: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (preview?.status !== 'running') return;
    const timer = setTimeout(() => setPreview(null), 3000);
    return () => clearTimeout(timer);
  }, [preview]);
  if (process.env.NODE_ENV !== 'development') return null;
  function show(status: string) {
    setPreview({ status });
    onOpenChange(false);
  }
  async function sendPush() {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? '테스트 알림을 보내지 못했어요.');
      setMessage('이 기기로 테스트 알림을 보냈어요. 기기 알림을 확인해 주세요.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '연결을 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="개발 메뉴"
        fallbackFocus={fallbackFocus}
      >
        <div className="development-tools">
          <section>
            <h3>기기 푸시</h3>
            <p>마이페이지에서 알림 받기를 켜 이 기기를 연결한 뒤 테스트해 주세요.</p>
            <Button disabled={busy} onClick={() => void sendPush()}>
              {busy ? '전송 중…' : '테스트 푸시 보내기'}
            </Button>
            {message && <p role="status">{message}</p>}
            {error && <p role="alert">{error}</p>}
          </section>
          <section>
            <h3>추천 팝업</h3>
            <p>
              진행 팝업은 3초 뒤 닫히고, 준비·실패 팝업은 직접 닫을 때까지 유지돼요. 실제 추천
              내역은 만들지 않아요.
            </p>
            <div className="development-preview-actions">
              <Button variant="secondary" onClick={() => show('running')}>
                진행 팝업 보기
              </Button>
              <Button variant="secondary" onClick={() => show('complete')}>
                준비 팝업 보기
              </Button>
              <Button variant="secondary" onClick={() => show('failed')}>
                실패 팝업 보기
              </Button>
            </div>
          </section>
        </div>
      </Dialog>
      {preview && !open && (
        <RecipeActivityPopup status={preview.status} onDismiss={() => setPreview(null)} />
      )}
    </>
  );
}
