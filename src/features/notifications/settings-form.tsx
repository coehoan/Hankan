'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { requestPushPermission, supportsPush } from './browser-push';
import { preferenceInput, preferenceResponse, type NotificationPreferences } from './contracts';
import { registerBrowserPush } from './push-controls';
type Draft = Pick<NotificationPreferences, 'enabled' | 'localTime'>;
type DeviceConnection = {
  controller: AbortController;
  permission: Promise<boolean>;
  started: boolean;
};
export function NotificationSettingsForm({ onAccessLost }: { onAccessLost?: () => void }) {
  const [saved, setSaved] = useState<NotificationPreferences | null>(null),
    [draft, setDraft] = useState<Draft>({ enabled: false, localTime: '09:00' }),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [online, setOnline] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [deviceMessage, setDeviceMessage] = useState(''),
    [revision, setRevision] = useState(0);
  const queued = useRef<Draft | null>(null),
    request = useRef<AbortController | null>(null),
    deviceConnection = useRef<DeviceConnection | null>(null),
    accessLost = useRef(onAccessLost);
  useEffect(() => {
    accessLost.current = onAccessLost;
  }, [onAccessLost]);
  const cancelConnection = useCallback(() => {
    deviceConnection.current?.controller.abort();
    deviceConnection.current = null;
  }, []);
  const read = useCallback(async (response: Response) => {
    const json = await response.json();
    if (!response.ok) {
      if ([401, 403].includes(response.status)) accessLost.current?.();
      throw new Error(json.error?.message ?? '알림 설정을 확인하지 못했어요.');
    }
    const parsed = preferenceResponse.safeParse(json.data);
    if (!parsed.success) throw new Error('알림 설정 응답을 확인하지 못했어요.');
    return parsed.data;
  }, []);
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    const sync = () => setOnline(navigator.onLine !== false);
    const clearIdentity = () => {
      cancelConnection();
      setDeviceMessage('');
    };
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    window.addEventListener('hankan:identity-cleared', clearIdentity);
    async function load() {
      setLoading(true);
      setError('');
      try {
        if (navigator.onLine === false)
          throw new Error('온라인으로 연결한 뒤 설정을 다시 불러와 주세요.');
        const value = await read(
          await fetch('/api/settings/notifications', {
            cache: 'no-store',
            signal: controller.signal,
          }),
        );
        if (live) {
          setSaved(value);
          setDraft({ enabled: value.enabled, localTime: value.localTime });
        }
      } catch (caught) {
        if (live)
          setError(caught instanceof Error ? caught.message : '알림 설정을 불러오지 못했어요.');
      } finally {
        if (live) setLoading(false);
      }
    }
    void load();
    return () => {
      live = false;
      controller.abort();
      request.current?.abort();
      cancelConnection();
      queued.current = null;
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
      window.removeEventListener('hankan:identity-cleared', clearIdentity);
    };
  }, [cancelConnection, read, revision]);
  function changeEnabled(enabled: boolean) {
    if (navigator.onLine === false) return;
    cancelConnection();
    setDeviceMessage('');
    if (enabled) {
      if (supportsPush()) {
        const controller = new AbortController();
        // Start the permission request during the switch gesture, before any save awaits.
        const permission = requestPushPermission().then(
          () => true,
          (caught: unknown) => {
            if (!controller.signal.aborted)
              setDeviceMessage(
                caught instanceof Error ? caught.message : '알림 권한을 확인하지 못했어요.',
              );
            return false;
          },
        );
        deviceConnection.current = { controller, permission, started: false };
      } else {
        setDeviceMessage(
          '이 환경은 푸시 알림을 지원하지 않아요. 홈 화면에 설치한 한칸에서 열어 주세요.',
        );
      }
    }
    void persist({ ...draft, enabled });
  }
  async function connectDevice() {
    const connection = deviceConnection.current;
    if (!connection || connection.started) return;
    connection.started = true;
    const { signal } = connection.controller;
    try {
      if (!(await connection.permission) || signal.aborted) return;
      await registerBrowserPush(signal, true);
      if (!signal.aborted) setDeviceMessage('이 기기에서 알림을 받을 수 있어요.');
    } catch (caught) {
      if (!signal.aborted)
        setDeviceMessage(caught instanceof Error ? caught.message : '기기를 연결하지 못했어요.');
    } finally {
      if (!signal.aborted) deviceConnection.current = null;
    }
  }
  async function persist(input: Draft) {
    if (
      !saved ||
      navigator.onLine === false ||
      (input.enabled === draft.enabled && input.localTime === draft.localTime)
    )
      return;
    const parsed = preferenceInput.safeParse(input);
    if (!parsed.success) return;
    setDraft(parsed.data);
    queued.current = parsed.data;
    if (request.current) return;

    setSaving(true);
    setError('');
    setNotice('');
    const controller = new AbortController();
    request.current = controller;
    let confirmed = saved;
    try {
      while (queued.current && !controller.signal.aborted) {
        const next = queued.current;
        queued.current = null;
        if (next.enabled === confirmed.enabled && next.localTime === confirmed.localTime) continue;
        confirmed = await read(
          await fetch('/api/settings/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(next),
            signal: controller.signal,
          }),
        );
        if (!controller.signal.aborted) setSaved(confirmed);
      }
      if (!controller.signal.aborted) {
        setDraft({ enabled: confirmed.enabled, localTime: confirmed.localTime });
        setNotice(confirmed.enabled ? '알림 설정을 저장했어요.' : '알림을 껐어요.');
      }
    } catch (caught) {
      if (!controller.signal.aborted) {
        queued.current = null;
        setDraft({ enabled: confirmed.enabled, localTime: confirmed.localTime });
        setError(caught instanceof Error ? caught.message : '연결을 확인하고 다시 시도해 주세요.');
      }
    } finally {
      request.current = null;
      if (!controller.signal.aborted) {
        setSaving(false);
        if (confirmed.enabled) void connectDevice();
        else cancelConnection();
      }
    }
  }
  return (
    <div className="notification-settings">
      <p>내가 참여한 냉장고의 임박 재료를 매일 한 번 모아 알려드려요.</p>
      {!online && (
        <p className="connection-banner" role="status">
          오프라인이에요. 연결한 뒤 알림 설정을 바꿀 수 있어요.
        </p>
      )}
      {loading ? (
        <p role="status">내 알림 설정을 불러오고 있어요…</p>
      ) : saved ? (
        <div className="notification-form">
          <label className="notification-toggle ios-switch">
            <input
              type="checkbox"
              role="switch"
              checked={draft.enabled}
              onChange={(event) => changeEnabled(event.target.checked)}
              disabled={!online}
            />
            <span className="ios-switch-track" aria-hidden="true" />
            <span>알림 받기</span>
          </label>
          {draft.enabled && (
            <div className="notification-time-settings">
              <label>
                매일 받을 시각
                <input
                  type="time"
                  step="60"
                  required
                  value={draft.localTime}
                  onChange={(event) => void persist({ ...draft, localTime: event.target.value })}
                  disabled={!online}
                />
              </label>
              <p className="notification-hint">
                오늘 아직 보내지 않았고 새 시각이 남아 있으면 오늘부터, 이미 지났거나 오늘 보냈으면
                내일부터 적용해요. 이 설정은 내 계정에만 적용돼요.
              </p>
            </div>
          )}
          {saving && <p role="status">알림 설정을 저장하고 있어요…</p>}
          {draft.enabled && deviceMessage && (
            <p className="notification-hint" role="status">
              {deviceMessage}
            </p>
          )}
        </div>
      ) : (
        <Button onClick={() => setRevision((value) => value + 1)} disabled={!online}>
          설정 다시 불러오기
        </Button>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notification-success">
          {notice}
        </p>
      )}
    </div>
  );
}
