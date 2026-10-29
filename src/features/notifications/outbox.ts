import 'server-only';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import type { Database, Json } from '@/lib/supabase/database.types';
import type { Ingredient } from '@/features/inventory/contracts';
import type { Digest, DigestJob, DispatchState, Outbox } from './types';
type Row = Database['public']['Tables']['ingredients']['Row'];
export function parseDigest(value: Json): Digest {
  const raw = value as unknown as {
    userId: string;
    localDate: string;
    groups: { fridgeId: string; fridgeName: string; ingredients: Row[] }[];
  };
  return {
    ...raw,
    groups: raw.groups.map((g) => ({
      ...g,
      ingredients: g.ingredients.map((i): Ingredient => ({
        id: i.id,
        fridgeId: i.fridge_id,
        name: i.name,
        normalizedName: i.normalized_name ?? i.name,
        storage: i.storage as Ingredient['storage'],
        expiresOn: i.expires_on,
        remainingPercent: i.remaining_percent,
        version: i.version,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
        createdBy: i.created_by,
        updatedBy: i.updated_by,
      })),
    })),
  };
}
export async function claimDueDigests(now: string, limit: number): Promise<DigestJob[]> {
  const { data, error } = await createAdminSupabaseClient().rpc('claim_notification_jobs', {
    at_time: now,
    batch_limit: limit,
  });
  if (error) throw new Error('Cannot claim notification jobs');
  return (data ?? []).map((j) => ({
    id: j.id,
    userId: j.user_id,
    localDate: j.local_date,
    dueAt: j.due_at,
    leaseUntil: j.lease_until,
    leaseToken: j.lease_token!,
    status: j.status as DigestJob['status'],
  }));
}
export const databaseOutbox: Outbox = {
  async prepare(job) {
    const { data, error } = await createAdminSupabaseClient().rpc('prepare_notification_dispatch', {
      job_id: job.id,
      token: job.leaseToken,
    });
    if (error) throw new Error('Cannot prepare notification');
    if (!data) return null;
    const raw = data as unknown as { subscriptions: NonNullable<DispatchState>['subscriptions'] };
    return { digest: parseDigest(data), subscriptions: raw.subscriptions };
  },
  async record(job, subscriptionId, result) {
    const { error } = await createAdminSupabaseClient().rpc('record_notification_delivery', {
      job_id: job.id,
      token: job.leaseToken,
      subscription_id: subscriptionId,
      delivery_status: result,
    });
    if (error) throw new Error('Cannot record notification');
  },
  async finish(job, retry) {
    const { error } = await createAdminSupabaseClient().rpc('finish_notification_job', {
      job_id: job.id,
      token: job.leaseToken,
      will_retry: retry,
    });
    if (error) throw new Error('Cannot finish notification');
  },
};
