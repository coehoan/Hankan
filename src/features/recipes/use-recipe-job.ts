'use client';
import { useEffect, useRef, useState } from 'react';
import { recipeJobPending, type RecipeJob } from './job-contracts';
type State = {
  key: string;
  job: RecipeJob | null;
  checking: boolean;
  submitting: boolean;
  error: string;
};
type Scope = {
  key: string;
  active: boolean;
  busy: boolean;
  sequence: number;
  controller: AbortController | null;
  requestId: string | null;
  refresh: () => Promise<void>;
  accept: (job: RecipeJob | null) => void;
};
const empty = (key: string): State => ({
  key,
  job: null,
  checking: true,
  submitting: false,
  error: '',
});
export function useRecipeJob(
  fridgeId: string,
  revoked: boolean,
  onAccessLost?: () => void,
  savedJobId?: string,
) {
  const key = fridgeId + ':' + (savedJobId ?? '');
  const [state, setState] = useState(() => empty(key));
  const scopeRef = useRef<Scope | null>(null),
    accessLost = useRef(onAccessLost);
  useEffect(() => {
    accessLost.current = onAccessLost;
  }, [onAccessLost]);
  useEffect(() => {
    let job: RecipeJob | null = null;
    const scope: Scope = {
      key,
      active: true,
      busy: false,
      sequence: 0,
      controller: null,
      requestId: null,
      refresh: async () => {},
      accept: (value) => {
        job = value;
      },
    };
    scopeRef.current = scope;
    const fetchJob = async (force = false) => {
      if (
        !scope.active ||
        scope.busy ||
        revoked ||
        navigator.onLine === false ||
        document.visibilityState === 'hidden'
      )
        return;
      if (!force && !scope.requestId && (!job || !recipeJobPending(job))) return;
      const controller = new AbortController(),
        sequence = ++scope.sequence,
        unresolvedRequestId = scope.requestId;
      scope.busy = true;
      scope.controller = controller;
      try {
        const response = await fetch(
          unresolvedRequestId
            ? '/api/fridges/' + encodeURIComponent(fridgeId) + '/recipes'
            : job
              ? '/api/recipe-jobs/' + encodeURIComponent(job.id)
              : savedJobId
                ? '/api/recipe-jobs/' + encodeURIComponent(savedJobId)
                : '/api/recipe-jobs?fridgeId=' + encodeURIComponent(fridgeId) + '&latest=1',
          {
            cache: 'no-store',
            signal: controller.signal,
            ...(unresolvedRequestId
              ? {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ requestId: unresolvedRequestId }),
                }
              : {}),
          },
        );
        const json = await response.json();
        if (!scope.active || sequence !== scope.sequence) return;
        if (!response.ok) {
          if (response.status < 500 && unresolvedRequestId) scope.requestId = null;
          if ([401, 403].includes(response.status) || (response.status === 404 && !!job)) {
            job = null;
            setState({ ...empty(key), checking: false });
            accessLost.current?.();
          }
          throw new Error(
            json.error?.message ?? '추천 상태를 확인하지 못했어요. 연결되면 다시 확인해요.',
          );
        }
        const next = Array.isArray(json.data) ? (json.data[0] ?? null) : json.data;
        if (
          next &&
          (next.fridgeId !== fridgeId ||
            !Array.isArray(next.matches) ||
            !Array.isArray(next.ingredients))
        )
          throw new Error('추천 내역을 확인하지 못했어요.');
        job = next;
        if (unresolvedRequestId) {
          scope.requestId = null;
          if (job)
            window.dispatchEvent(
              new CustomEvent('hankan:recipe-job', { detail: { id: job.id, status: job.status } }),
            );
        }
        setState({ key, job, checking: false, submitting: false, error: '' });
      } catch (error) {
        if (scope.active && !controller.signal.aborted)
          setState((previous) => ({
            ...(previous.key === key ? previous : empty(key)),
            key,
            checking: false,
            error: error instanceof Error ? error.message : '연결을 확인해 주세요.',
          }));
      } finally {
        if (scope.controller === controller) scope.controller = null;
        scope.busy = false;
      }
    };
    scope.refresh = () => fetchJob(true);
    if (!revoked) void fetchJob(true);
    const timer = setInterval(() => void fetchJob(), 2000);
    const refresh = () => void fetchJob(true);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      scope.active = false;
      scope.controller?.abort();
      clearInterval(timer);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [key, fridgeId, revoked, savedJobId]);
  const current = state.key === key && !revoked ? state : empty(key);
  async function start() {
    const scope = scopeRef.current;
    if (
      !scope?.active ||
      scope.key !== key ||
      scope.busy ||
      revoked ||
      navigator.onLine === false ||
      savedJobId
    )
      return;
    scope.requestId ??= crypto.randomUUID();
    scope.busy = true;
    const sequence = ++scope.sequence,
      controller = new AbortController();
    scope.controller = controller;
    setState((previous) => ({
      ...(previous.key === key ? previous : empty(key)),
      key,
      submitting: true,
      error: '',
    }));
    try {
      const response = await fetch('/api/fridges/' + encodeURIComponent(fridgeId) + '/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: scope.requestId }),
        cache: 'no-store',
        signal: controller.signal,
      });
      const json = await response.json();
      if (!scope.active || sequence !== scope.sequence) return;
      if (!response.ok) {
        if (response.status < 500) scope.requestId = null;
        if ([401, 403].includes(response.status)) {
          scope.accept(null);
          setState({ ...empty(key), checking: false });
          accessLost.current?.();
        }
        throw new Error(json.error?.message ?? '추천을 접수하지 못했어요. 다시 시도해 주세요.');
      }
      if (json.data?.fridgeId !== fridgeId || !Array.isArray(json.data?.matches))
        throw new Error('추천 요청을 확인하지 못했어요.');
      scope.requestId = null;
      scope.accept(json.data);
      window.dispatchEvent(
        new CustomEvent('hankan:recipe-job', {
          detail: { id: json.data.id, status: json.data.status },
        }),
      );
      setState({ key, job: json.data, checking: false, submitting: false, error: '' });
    } catch (error) {
      if (scope.active && !controller.signal.aborted)
        setState((previous) => ({
          ...previous,
          key,
          checking: false,
          submitting: false,
          error: error instanceof Error ? error.message : '연결을 확인해 주세요.',
        }));
    } finally {
      scope.busy = false;
      if (scope.controller === controller) scope.controller = null;
    }
  }
  // Polling uses the server state, including a job accepted while the POST response was lost.
  return { ...current, start, refresh: () => scopeRef.current?.refresh() };
}
