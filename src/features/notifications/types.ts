import type { Ingredient } from '@/features/inventory/contracts';
export type DigestGroup = { fridgeId: string; fridgeName: string; ingredients: Ingredient[] };
export type Digest = { userId: string; localDate: string; groups: DigestGroup[] };
export type DigestJob = {
  id: string;
  userId: string;
  localDate: string;
  dueAt: string;
  leaseUntil: string | null;
  leaseToken: string;
  status: 'pending' | 'leased' | 'sent' | 'skipped' | 'retry';
};
export type PushSubscriptionRecord = {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};
export type PushPayload = {
  notificationId: string;
  digestId: string;
  title: string;
  body: string;
  url: string;
};
export interface PushTransport {
  send(
    subscription: PushSubscriptionRecord,
    payload: PushPayload,
  ): Promise<'sent' | 'gone' | 'retry'>;
}
export type DispatchState = { digest: Digest; subscriptions: PushSubscriptionRecord[] } | null;
export interface Outbox {
  prepare(job: DigestJob): Promise<DispatchState>;
  record(job: DigestJob, subscriptionId: string, result: 'sent' | 'gone'): Promise<void>;
  finish(job: DigestJob, retry: boolean): Promise<void>;
}
