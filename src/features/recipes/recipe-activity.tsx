'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
type Activity = { id: string; status: string };
export function RecipeActivity() {
  const [notice, setNotice] = useState<Activity | null>(null);
  useEffect(() => {
    let active = true,
      busy = false,
      controller: AbortController | null = null;
    const known = new Map<string, string>(),
      dismissed = new Set<string>();
    const load = async () => {
      if (!active || busy || navigator.onLine === false || document.visibilityState === 'hidden')
        return;
      busy = true;
      controller = new AbortController();
      try {
        const response = await fetch('/api/recipe-jobs?activity=1', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const json = await response.json();
        if (!active) return;
        if (!response.ok) {
          if ([401, 403].includes(response.status)) {
            known.clear();
            setNotice(null);
          }
          return;
        }
        const jobs: Activity[] = Array.isArray(json.data) ? json.data : [];
        let completed: Activity | null = null;
        for (const job of jobs) {
          const before = known.get(job.id);
          if (
            ['queued', 'running'].includes(before ?? '') &&
            ['complete', 'failed'].includes(job.status)
          )
            completed = job;
          known.set(job.id, job.status);
        }
        const pending = jobs.find((job) => ['queued', 'running'].includes(job.status));
        setNotice((previous) =>
          completed && !dismissed.has(completed.id)
            ? completed
            : (pending ??
              (previous && jobs.some((job) => job.id === previous.id) && !dismissed.has(previous.id)
                ? previous
                : null)),
        );
      } catch {
        /* The result screen owns connection errors. */
      } finally {
        busy = false;
      }
    };
    const accepted = (event: Event) => {
      const job = (event as CustomEvent<Activity>).detail;
      if (job?.id) {
        known.set(job.id, 'queued');
      }
      void load();
    };
    const dismiss = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      dismissed.add(id);
      setNotice(null);
    };
    void load();
    const timer = setInterval(() => {
      if ([...known.values()].some((status) => ['queued', 'running'].includes(status))) void load();
    }, 5000);
    window.addEventListener('focus', load);
    window.addEventListener('online', load);
    window.addEventListener('hankan:recipe-job', accepted);
    window.addEventListener('hankan:recipe-dismiss', dismiss);
    document.addEventListener('visibilitychange', load);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      window.removeEventListener('focus', load);
      window.removeEventListener('online', load);
      window.removeEventListener('hankan:recipe-job', accepted);
      window.removeEventListener('hankan:recipe-dismiss', dismiss);
      document.removeEventListener('visibilitychange', load);
    };
  }, []);
  if (!notice) return null;
  const pending = ['queued', 'running'].includes(notice.status);
  return (
    <aside className="recipe-activity" aria-label="요리 추천 상태">
      <p role="status">
        {pending
          ? '요리 추천이 진행 중이에요. 다른 화면에서도 이어서 확인할 수 있어요.'
          : notice.status === 'failed'
            ? '요리 추천을 완료하지 못했어요. 내역을 확인해 주세요.'
            : '요리 추천이 준비됐어요. 저장된 결과를 확인해 보세요.'}
      </p>
      <Link href={'/recipes/jobs/' + notice.id}>{pending ? '진행 상태 보기' : '결과 보기'}</Link>
      {!pending && (
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent('hankan:recipe-dismiss', { detail: notice.id }))
          }
        >
          닫기
        </button>
      )}
    </aside>
  );
}
