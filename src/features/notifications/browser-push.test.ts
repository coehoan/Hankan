import { it, expect, vi } from 'vitest';
import { bindPushIdentity } from './browser-push';
function installing() {
  const worker = Object.assign(new EventTarget(), { state: 'installing', postMessage: vi.fn() });
  return {
    worker,
    registration: {
      active: null,
      waiting: null,
      installing: worker,
    } as unknown as ServiceWorkerRegistration,
  };
}
it('logout_during_install_cannot_restore_old_push_identity', async () => {
  const { worker, registration } = installing(),
    controller = new AbortController();
  const pending = bindPushIdentity(registration, 'old-user', controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  worker.state = 'activated';
  worker.dispatchEvent(new Event('statechange'));
  expect(worker.postMessage).not.toHaveBeenCalled();
});
it('identity_is_bound_only_after_activation', async () => {
  const { worker, registration } = installing();
  const pending = bindPushIdentity(registration, 'user');
  expect(worker.postMessage).not.toHaveBeenCalled();
  worker.state = 'activated';
  worker.dispatchEvent(new Event('statechange'));
  await pending;
  expect(worker.postMessage).toHaveBeenCalledWith({ type: 'BIND_USER', userId: 'user' });
});
