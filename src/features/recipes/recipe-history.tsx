'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { recipeJobPending, type RecipeJob } from './job-contracts';
import { recipeCondition } from './recipe-condition';
export function RecipeHistory({
  timeZone,
  onAccessLost,
  fridgeId,
}: {
  timeZone: string;
  onAccessLost?: () => void;
  fridgeId?: string;
}) {
  const [state, setState] = useState<{ jobs: RecipeJob[]; loading: boolean; error: string }>({
    jobs: [],
    loading: true,
    error: '',
  });
  const [attempt, setAttempt] = useState(0);
  const [selectedJob, setSelectedJob] = useState<RecipeJob | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const listVersion = useRef(0);
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
      const version = listVersion.current;
      controller = new AbortController();
      try {
        const response = await fetch('/api/recipe-jobs', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const json = await response.json();
        if (!active || version !== listVersion.current) return;
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
        if (active && !controller.signal.aborted && version === listVersion.current)
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

  async function deleteSelectedJob() {
    if (!selectedJob || deleting) return;
    const { id } = selectedJob;
    setDeleting(true);
    setDeleteError('');
    try {
      const response = await fetch('/api/recipe-jobs/' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        if (response.status === 401) onAccessLost?.();
        throw new Error('Delete failed');
      }
      listVersion.current += 1;
      setState((previous) => ({
        ...previous,
        jobs: previous.jobs.filter((job) => job.id !== id),
      }));
      setSelectedJob(null);
      setAnnouncement('추천 내역을 삭제했어요.');
      setAttempt((value) => value + 1);
    } catch {
      setDeleteError('추천 내역을 삭제하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="recipes-page recipe-history">
      <header className="recipes-page-heading">
        <p className="workspace-kicker">저장한 한 끼</p>
        <h1 ref={heading} tabIndex={-1}>
          추천 내역
        </h1>
        <p>요청할 때의 재료와 요리법을 최근 30건까지 다시 볼 수 있어요.</p>
      </header>
      {announcement && <p role="status">{announcement}</p>}
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
          {fridgeId && (
            <Link className="secondary-button" href={'/fridges/' + fridgeId + '/recipes'}>
              요리 추천으로 가기
            </Link>
          )}
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
              <p>{recipeCondition(job)}</p>
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
            <div className="recipe-history-actions">
              <Link href={'/recipes/jobs/' + job.id} prefetch={false}>
                {recipeJobPending(job) ? '진행 상태 보기' : '추천 보기'}
              </Link>
              {!recipeJobPending(job) && (
                <Button
                  variant="ghost"
                  aria-label={(job.matches[0]?.recipe.name ?? '저장된 요리 추천') + ' 내역 삭제'}
                  onClick={() => {
                    setAnnouncement('');
                    setDeleteError('');
                    setSelectedJob(job);
                  }}
                >
                  삭제
                </Button>
              )}
            </div>
          </li>
        ))}
      </ol>
      <Dialog
        open={selectedJob !== null}
        title="추천 내역 삭제"
        closeDisabled={deleting}
        onOpenChange={(open) => {
          if (!open) setSelectedJob(null);
        }}
        fallbackFocus={() => heading.current}
      >
        <p>
          {selectedJob?.matches[0]?.recipe.name
            ? '‘' + selectedJob.matches[0].recipe.name + '’이 포함된 추천 내역을 삭제할까요?'
            : '이 추천 내역을 삭제할까요?'}
          {' 삭제하면 추천 목록과 상세 화면에서 볼 수 없어요.'}
        </p>
        {deleteError && (
          <p className="form-message error" role="alert">
            {deleteError}
          </p>
        )}
        <div className="dialog-actions">
          <Button variant="ghost" disabled={deleting} onClick={() => setSelectedJob(null)}>
            취소
          </Button>
          <Button
            variant="destructive"
            disabled={deleting}
            onClick={() => void deleteSelectedJob()}
          >
            {deleting ? '삭제 중…' : '삭제하기'}
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
