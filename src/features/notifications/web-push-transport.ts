import 'server-only';
import webpush from 'web-push';
import type { PushTransport } from './types';
export function allowedPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.hash &&
      (/^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com)$/.test(
        u.hostname,
      ) ||
        /(^|\.)(notify|wns)\.windows\.com$/.test(u.hostname))
    );
  } catch {
    return false;
  }
}
export function createWebPushTransport(): PushTransport | null {
  const subject = process.env.VAPID_SUBJECT,
    publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return null;
  return {
    async send(subscription, payload) {
      if (!allowedPushEndpoint(subscription.endpoint)) return 'gone';
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
          {
            vapidDetails: { subject, publicKey, privateKey },
            timeout: 10000,
            TTL: 3600,
            urgency: 'normal',
          },
        );
        return 'sent';
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        return status === 404 || status === 410 ? 'gone' : 'retry';
      }
    },
  };
}
