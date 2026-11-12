'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PantryIcon } from '@/components/ui/pantry-icon';
type Activity = { id: string; status: string };
export function RecipeActivity() {
  const [notice, setNotice] = useState<Activity | null>(null);
  const [hiddenProgress, setHiddenProgress] = useState(() => new Set<string>());
  const dismissed = useRef(new Set<string>());
  useEffect(() => {
    let active = true,
      busy = false,
      controller: AbortController | null = null;
    const known = new Map<string, string>();
    const dismissedJobs = dismissed.current;
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
            ['complete', 'failed'].includes(job.status) &&
            !dismissedJobs.has(job.id)
          )
            completed = job;
          known.set(job.id, job.status);
        }
        const pending = jobs.find((job) => ['queued', 'running'].includes(job.status));
        setNotice((previous) =>
          completed && !dismissedJobs.has(completed.id)
            ? completed
            : (pending ??
              (previous &&
              jobs.some((job) => job.id === previous.id) &&
              !dismissedJobs.has(previous.id)
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
    void load();
    const timer = setInterval(() => {
      if ([...known.values()].some((status) => ['queued', 'running'].includes(status))) void load();
    }, 5000);
    window.addEventListener('focus', load);
    window.addEventListener('online', load);
    window.addEventListener('hankan:recipe-job', accepted);
    document.addEventListener('visibilitychange', load);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      window.removeEventListener('focus', load);
      window.removeEventListener('online', load);
      window.removeEventListener('hankan:recipe-job', accepted);
      document.removeEventListener('visibilitychange', load);
    };
  }, []);
  const noticeId = notice?.id;
  const pending = !!notice && ['queued', 'running'].includes(notice.status);
  useEffect(() => {
    if (!pending || !noticeId) return;
    const timer = setTimeout(() => {
      setHiddenProgress((previous) => new Set(previous).add(noticeId));
    }, 3000);
    return () => clearTimeout(timer);
  }, [noticeId, pending]);
  if (!notice || (pending && hiddenProgress.has(notice.id))) return null;
  const dismiss = () => {
    if (pending) {
      setHiddenProgress((previous) => new Set(previous).add(notice.id));
      return;
    }
    dismissed.current.add(notice.id);
    setNotice((previous) => (previous?.id === notice.id ? null : previous));
  };
  return (
    <RecipeActivityPopup
      status={notice.status}
      href={'/recipes/jobs/' + notice.id}
      onDismiss={dismiss}
    />
  );
}

export function RecipeActivityPopup({
  status,
  href,
  onDismiss,
}: {
  status: string;
  href?: string;
  onDismiss: () => void;
}) {
  const pending = ['queued', 'running'].includes(status);
  const failed = status === 'failed';
  const message = pending
    ? '요리 추천이 진행 중이에요'
    : failed
      ? '요리 추천에 실패했어요'
      : '요리 추천이 준비됐어요';
  return (
    <aside className="recipe-activity" aria-label="요리 추천 상태" data-status={status}>
      <Link
        className="recipe-activity-link"
        href={href ?? '#'}
        aria-label={message}
        onNavigate={pending ? undefined : onDismiss}
        onClick={
          href
            ? undefined
            : (event) => {
                event.preventDefault();
                if (!pending) onDismiss();
              }
        }
      >
        <span className="recipe-activity-mark">
          <PantryIcon name={pending ? 'bowl' : failed ? 'alert' : 'check'} />
        </span>
        <span role="status">{message}</span>
        <span className="recipe-activity-chevron">
          <PantryIcon name="chevronRight" />
        </span>
      </Link>
      <Button
        variant="ghost"
        className="recipe-activity-close"
        aria-label="요리 추천 알림 닫기"
        onClick={onDismiss}
      >
        <PantryIcon name="close" />
      </Button>
    </aside>
  );
}
