'use client';
export function supportsPush() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}
export async function registerWorker() {
  return navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
}
export async function requestPushPermission() {
  const current = Notification.permission;
  const permission =
    current === 'granted' || current === 'denied'
      ? current
      : await Notification.requestPermission();
  if (permission !== 'granted')
    throw new Error('알림이 허용되지 않았어요. 기기 설정에서 한칸의 알림 권한을 확인해 주세요.');
}
export async function clearBrowserPush() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  (registration?.active ?? navigator.serviceWorker.controller)?.postMessage({
    type: 'CLEAR_PRIVATE',
  });
  await (await registration?.pushManager.getSubscription())?.unsubscribe();
}
export async function bindPushIdentity(
  registration: ServiceWorkerRegistration,
  userId: string,
  signal?: AbortSignal,
  confirm = false,
) {
  const worker = confirm
    ? (registration.installing ?? registration.waiting ?? registration.active)
    : (registration.active ?? registration.waiting ?? registration.installing);
  if (!worker) {
    if (confirm) throw new Error('한칸을 다시 열고 테스트해 주세요.');
    return;
  }
  if (worker.state !== 'activated')
    await new Promise<void>((resolve, reject) => {
      const done = () => {
        worker.removeEventListener('statechange', change);
        signal?.removeEventListener('abort', abort);
      };
      const change = () => {
        if (worker.state === 'activated') {
          done();
          resolve();
        } else if (worker.state === 'redundant') {
          done();
          reject(new Error('알림 연결을 다시 시도해 주세요.'));
        }
      };
      const abort = () => {
        done();
        reject(new DOMException('Aborted', 'AbortError'));
      };
      worker.addEventListener('statechange', change);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
      else change();
    });
  signal?.throwIfAborted();
  const message = { type: 'BIND_USER', userId };
  if (!confirm) {
    worker.postMessage(message);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const { port1, port2 } = new MessageChannel();
    const finish = (error?: unknown) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      port1.close();
      port2.close();
      if (error) reject(error);
      else resolve();
    };
    const abort = () => finish(signal?.reason);
    const unavailable = () => finish(new Error('한칸을 다시 열고 테스트해 주세요.'));
    const timer = setTimeout(unavailable, 5000);
    signal?.addEventListener('abort', abort, { once: true });
    port1.onmessage = (event) => (event.data === true ? finish() : unavailable());
    try {
      worker.postMessage(message, [port2]);
    } catch (error) {
      finish(error);
    }
  });
}
