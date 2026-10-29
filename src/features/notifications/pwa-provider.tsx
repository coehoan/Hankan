'use client';
import { useEffect } from 'react';
import { bindPushIdentity, clearBrowserPush, registerWorker } from './browser-push';
export function PwaProvider({ userId }: { userId?: string }) {
  useEffect(() => {
    if (!userId || !('serviceWorker' in navigator) || !window.isSecureContext) return;
    const controller = new AbortController();
    void registerWorker()
      .then((r) => {
        if (!controller.signal.aborted) return bindPushIdentity(r, userId, controller.signal);
      })
      .catch(() => {});
    const clear = () => {
      controller.abort();
      void clearBrowserPush().catch(() => {});
    };
    window.addEventListener('hankan:identity-cleared', clear);
    return () => {
      controller.abort();
      window.removeEventListener('hankan:identity-cleared', clear);
    };
  }, [userId]);
  return null;
}
