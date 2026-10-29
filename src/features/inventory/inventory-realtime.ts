'use client';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import type { RealtimeChannel } from '@supabase/supabase-js';

const leaving = new WeakMap<object, Map<string, Promise<unknown>>>();

export type InventoryRealtimeStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';
export function subscribeToInventory(
  fridgeId: string,
  callbacks: {
    onChange: () => void;
    onStatus: (status: InventoryRealtimeStatus) => void;
    onAccessLost?: () => void;
  },
): () => void {
  const client = createBrowserSupabaseClient();
  const topic = 'fridge:' + fridgeId + ':inventory';
  let active = true;
  let channel: RealtimeChannel | undefined;
  const { data: auth } = client.auth.onAuthStateChange((event) => {
    if (active && event === 'SIGNED_OUT') callbacks.onAccessLost?.();
  });
  const open = () => {
    if (!active) return;
    try {
      channel = client
        .channel(topic, { config: { private: true } })
        .on('broadcast', { event: 'inventory_changed' }, () => {
          if (active) callbacks.onChange();
        })
        .subscribe((status) => {
          if (active) callbacks.onStatus(status);
        });
    } catch {
      callbacks.onStatus('CHANNEL_ERROR');
    }
  };
  // The SDK reuses same-topic channels until their asynchronous unsubscribe finishes.
  const previous = leaving.get(client)?.get(topic);
  if (previous) void previous.then(open);
  else open();
  return () => {
    if (!active) return;
    active = false;
    auth.subscription.unsubscribe();
    if (!channel) return;
    let pending = leaving.get(client);
    if (!pending) {
      pending = new Map();
      leaving.set(client, pending);
    }
    const removal = client.removeChannel(channel).catch(() => {});
    pending.set(topic, removal);
    void removal.then(() => {
      if (pending.get(topic) === removal) pending.delete(topic);
    });
  };
}
