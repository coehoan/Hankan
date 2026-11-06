'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { recipeJobPending, type RecipeJob } from './job-contracts';
export function RecipeHistory({
  timeZone,
  onAccessLost,
}: {
  timeZone: string;
  onAccessLost?: () => void;
}) {
  const [state, setState] = useState<{ jobs: RecipeJob[]; loading: boolean; error: string }>({
    jobs: [],
    loading: true,
    error: '',
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true,
      busy = false,
      controller: AbortController | null = null,
      pending = true;
    const load = async (force = false) => {
      if (
        !active ||
        busy ||
        (!force && !pending) ||
        navigator.onLine === false ||
        document.visibilityState === 'hidden'
      )
        return;
      busy = true;
      controller = new AbortController();
      try {
        const response = await fetch('/api/recipe-jobs', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const json = await response.json();
        if (!active) return;
        if (!response.ok) {
          if ([401, 403].includes(response.status)) {
            setState({ jobs: [], loading: false, error: '로그인을 다시 확인해 주세요.' });
            onAccessLost?.();
            return;
          }
          throw new Error('추천 내역을 불러오지 못했어요.');
        }
        if (!Array.isArray(json.data)) throw new Error('추천 내역을 확인하지 못했어요.');
        pending = json.data.some(recipeJobPending);
        setState({ jobs: json.data, loading: false, error: '' });
      } catch {
        if (active && !controller.signal.aborted)
          setState((previous) => ({
            ...previous,
            loading: false,
            error: '연결을 확인한 뒤 다시 불러와 주세요.',
          }));
      } finally {
        busy = false;
      }
    };
    void load(true);
    const timer = setInterval(() => void load(), 3000),
      refresh = () => void load(true);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [attempt, onAccessLost]);
  return (
    <main className="recipes-page recipe-history">
      <header className="recipes-page-heading">
        <h1>추천 내역</h1>
        <p>요청할 때의 재료와 요리법을 최근 30건까지 다시 볼 수 있어요.</p>
      </header>
      {state.loading && <p role="status">추천 내역을 불러오고 있어요…</p>}
      {state.error && (
        <div className="recipe-error">
          <p role="alert">{state.error}</p>
          <Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>
            다시 불러오기
          </Button>
        </div>
      )}
      {!state.loading && !state.error && !state.jobs.length && (
        <div className="recipe-empty">
          <h2>아직 저장된 추천이 없어요</h2>
          <p>냉장고에서 요리를 추천받으면 여기에 모아둘게요.</p>
        </div>
      )}
      <ol className="recipe-history-list">
        {state.jobs.map((job) => (
          <li key={job.id}>
            <div>
              <time dateTime={job.createdAt}>
                {new Intl.DateTimeFormat('ko-KR', {
                  timeZone,
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(job.createdAt))}
              </time>
              <h2>
                {job.matches[0]?.recipe.name ??
                  (recipeJobPending(job) ? '요리를 찾고 있어요' : '저장된 요리 추천')}
                {job.matches.length > 1 && ' 외 ' + (job.matches.length - 1) + '개'}
              </h2>
              <p>
                {recipeJobPending(job)
                  ? job.matches.length
                    ? '일부 요리 준비됨'
                    : '추천 중'
                  : job.status === 'complete'
                    ? '추천 완료'
                    : job.status === 'cancelled'
                      ? '중단됨'
                      : '추천을 완료하지 못했어요'}
              </p>
            </div>
            <Link href={'/recipes/jobs/' + job.id}>
              {recipeJobPending(job) ? '진행 상태 보기' : '추천 보기'}
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
