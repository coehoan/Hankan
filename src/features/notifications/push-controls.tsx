'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { bindPushIdentity, clearBrowserPush, registerWorker, supportsPush } from './browser-push';
type Configuration = { userId: string; publicKey: string | null; connected: boolean };
function keyBytes(value: string) {
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
async function configuration(signal?: AbortSignal) {
  const response = await fetch('/api/push/subscriptions', { cache: 'no-store', signal });
  if (!response.ok) throw new Error('알림 연결 상태를 확인하지 못했어요.');
  return (await response.json()).data as Configuration;
}
async function connectBrowser(signal: AbortSignal, forTest = false) {
  const permission = await Notification.requestPermission();
  signal.throwIfAborted();
  if (permission !== 'granted')
    throw new Error('알림이 허용되지 않았어요. 기기 설정에서 한칸의 알림 권한을 확인해 주세요.');
  const current = await configuration(signal);
  if (!current.publicKey) throw new Error('브라우저 알림 연결을 준비 중이에요.');
  const registration = await registerWorker();
  await navigator.serviceWorker.ready;
  if (forTest) await registration.update();
  await bindPushIdentity(registration, current.userId, signal, forTest);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !current.connected) {
    await subscription.unsubscribe();
    subscription = null;
  }
  signal.throwIfAborted();
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(current.publicKey),
  });
  signal.throwIfAborted();
  const response = await fetch('/api/push/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
    signal,
  });
  if (!response.ok) {
    // A failed save should not remove an existing, working subscription.
    if (!current.connected) await subscription.unsubscribe();
    throw new Error('연결하지 못했어요. 알림 일정을 저장한 뒤 다시 시도해 주세요.');
  }
  return { current, subscription };
}

export function TestPushButton({ enabled, disabled }: { enabled: boolean; disabled: boolean }) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const cancel = () => request.current?.abort();
    window.addEventListener('hankan:identity-cleared', cancel);
    return () => {
      cancel();
      window.removeEventListener('hankan:identity-cleared', cancel);
    };
  }, []);

  async function send() {
    if (!enabled || disabled || request.current) return;
    if (!supportsPush()) {
      setMessage('이 환경은 푸시 알림을 지원하지 않아요. 홈 화면에 설치한 한칸에서 열어 주세요.');
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setSending(true);
    setMessage('');
    try {
      const { subscription } = await connectBrowser(controller.signal, true);
      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: controller.signal,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        if (response.status === 409) await subscription.unsubscribe().catch(() => {});
        throw new Error(result?.error?.message ?? '테스트 알림을 보내지 못했어요.');
      }
      setMessage('테스트 알림을 보냈어요. 기기의 알림을 확인해 주세요.');
    } catch (error) {
      if (!controller.signal.aborted)
        setMessage(error instanceof Error ? error.message : '테스트 알림을 보내지 못했어요.');
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setSending(false);
    }
  }

  return (
    <div className="push-controls">
      <Button disabled={!enabled || disabled || sending} onClick={() => void send()}>
        {sending ? '테스트 알림 보내는 중…' : '테스트 알림 보내기'}
      </Button>
      {!enabled && <p className="notification-hint">알림 받기를 켜고 저장한 뒤 테스트해 주세요.</p>}
      {message && <p role="status">{message}</p>}
    </div>
  );
}

export function PushControls({ enabled }: { enabled: boolean }) {
  const [config, setConfig] = useState<Configuration | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const supported = useSyncExternalStore(
    () => () => {},
    supportsPush,
    () => false,
  );
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const cancel = () => request.current?.abort();
    window.addEventListener('hankan:identity-cleared', cancel);
    return () => {
      cancel();
      window.removeEventListener('hankan:identity-cleared', cancel);
    };
  }, []);
  useEffect(() => {
    if (!supported) return;
    let active = true;
    void configuration()
      .then((value) => {
        if (active) setConfig(value);
      })
      .catch(() => {
        if (active) setMessage('연결 상태를 불러오지 못했어요. 설정을 다시 열어 주세요.');
      });
    return () => {
      active = false;
    };
  }, [supported, enabled]);
  useEffect(() => {
    if (!enabled && supportsPush()) void clearBrowserPush().catch(() => {});
  }, [enabled]);
  async function connect() {
    if (busy) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setMessage('');
    try {
      const { current } = await connectBrowser(controller.signal);
      setConfig({ ...current, connected: true });
      setMessage('이 브라우저에서 알림을 받을 수 있어요.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '브라우저 알림을 연결하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/push/subscriptions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error('알림 연결을 해제하지 못했어요.');
      await clearBrowserPush();
      setConfig((value) => (value ? { ...value, connected: false } : null));
      setMessage('이 브라우저의 알림 연결을 해제했어요.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '연결을 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="push-controls" aria-label="브라우저 알림 연결">
      <h3>이 브라우저에서 받기</h3>
      {supported ? (
        <>
          <p>{enabled && config?.connected ? '알림 연결됨' : '브라우저 알림을 연결해 주세요.'}</p>
          {enabled && config?.connected ? (
            <Button disabled={busy} onClick={() => void disconnect()}>
              브라우저 알림 해제
            </Button>
          ) : (
            <Button
              disabled={busy || !enabled || !config?.publicKey}
              onClick={() => void connect()}
            >
              {busy ? '연결 중…' : '브라우저 알림 연결'}
            </Button>
          )}
          {!enabled && <p>알림 일정 설정에서 일정을 켜고 저장한 뒤 연결해 주세요.</p>}
        </>
      ) : (
        <p>
          현재 환경에서는 웹 푸시를 연결할 수 없어요. 지원 브라우저와 보안 연결을 사용해 주세요.
        </p>
      )}
      <p className="notification-hint">
        아이폰·아이패드에서는 사파리의 공유 메뉴에서 ‘홈 화면에 추가’한 뒤, 설치한 한칸을 열어
        연결해 주세요. 운영체제 16.4 이상이 필요해요.
      </p>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
