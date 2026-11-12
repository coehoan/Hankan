'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { supportsPush } from './browser-push';
import { readPushConfiguration } from './push-controls';

type DeviceState = { message: string; canConnect: boolean };
async function readDeviceState(signal: AbortSignal): Promise<DeviceState> {
  if (!supportsPush())
    return {
      message:
        '이 환경에서는 푸시 알림을 연결할 수 없어요. iPhone·iPad는 홈 화면에 추가한 한칸에서 확인해 주세요.',
      canConnect: false,
    };
  if (Notification.permission !== 'granted')
    return {
      message:
        Notification.permission === 'denied'
          ? '이 기기의 알림이 차단됐어요. 브라우저 또는 기기 설정에서 알림을 허용해 주세요.'
          : '이 기기에서 알림을 받으려면 권한을 허용하고 연결해 주세요.',
      canConnect: Notification.permission !== 'denied',
    };
  try {
    const [config, registration] = await Promise.all([
      readPushConfiguration(signal),
      navigator.serviceWorker.getRegistration('/'),
    ]);
    const subscription = await registration?.pushManager.getSubscription();
    const connected = config.connected === true && !!subscription;
    return {
      message: connected
        ? '이 기기의 알림 권한과 연결이 확인됐어요.'
        : '계정 알림은 켜져 있지만 이 기기는 아직 연결되지 않았어요.',
      canConnect: !connected,
    };
  } catch {
    return {
      message: '이 기기의 연결 상태를 확인하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.',
      canConnect: false,
    };
  }
}
export function DevicePushStatus({
  revision,
  onConnect,
}: {
  revision: string;
  onConnect: () => Promise<void>;
}) {
  const [state, setState] = useState<DeviceState>({
    message: '이 기기의 알림 연결을 확인하고 있어요…',
    canConnect: false,
  });
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState(0);
  useEffect(() => {
    let pending: AbortController | undefined;
    async function load() {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      const next = await readDeviceState(controller.signal);
      if (!controller.signal.aborted) setState(next);
    }
    void load();
    const reload = () => void load();
    window.addEventListener('focus', reload);
    window.addEventListener('online', reload);
    return () => {
      pending?.abort();
      window.removeEventListener('focus', reload);
      window.removeEventListener('online', reload);
    };
  }, [revision, check]);
  return (
    <div className="device-push-status">
      <p className="notification-hint" role="status">
        {state.message}
      </p>
      <Button variant="text" disabled={busy} onClick={() => setCheck((value) => value + 1)}>
        연결 상태 다시 확인
      </Button>
      {state.canConnect && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            try {
              await onConnect();
              setCheck((value) => value + 1);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? '연결 중…' : '이 기기 알림 연결'}
        </Button>
      )}
    </div>
  );
}
