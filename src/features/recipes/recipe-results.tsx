'use client';
import { useId, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Ingredient } from '@/features/inventory/contracts';
import { inventoryVersion, usableIngredients } from './domain';
import { RecipeDetail } from './recipe-detail';
import { recipeMetadata } from './recipe-metadata';
import { recipeJobPending } from './job-contracts';
import { useRecipeJob } from './use-recipe-job';
type Props = {
  fridgeId: string;
  ingredients: Ingredient[];
  today: string;
  online: boolean;
  loading: boolean;
  revoked: boolean;
  pending?: boolean;
  inventoryError?: boolean;
  compact?: boolean;
  onAccessLost?: () => void;
  savedJobId?: string;
};
export function RecipeResults({
  fridgeId,
  ingredients,
  today,
  online,
  loading,
  revoked,
  pending = false,
  inventoryError = false,
  compact = false,
  onAccessLost,
  savedJobId,
}: Props) {
  const state = useRecipeJob(fridgeId, revoked, onAccessLost, savedJobId),
    headingId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const job = state.job,
    matches = job?.matches ?? [],
    working = !!job && recipeJobPending(job),
    selected = matches.find((item) => item.recipe.id === selectedId);
  const stale =
    !!job && (job.inventoryVersion !== inventoryVersion(ingredients) || job.today !== today);
  const usable = usableIngredients(ingredients, today);
  const disabled =
    loading ||
    revoked ||
    pending ||
    inventoryError ||
    !online ||
    state.checking ||
    state.submitting ||
    working ||
    !usable.length;
  if (revoked)
    return (
      <p className="recipe-feedback" role="alert">
        냉장고 접근 권한이 변경되어 추천을 지웠어요.
      </p>
    );
  return (
    <section
      className={compact ? 'recipe-results compact' : 'recipe-results'}
      aria-label="재료로 찾는 요리"
    >
      <header className="recipe-results-intro">
        <div>
          <h2>
            {savedJobId ? (
              '저장된 요리 추천'
            ) : compact ? (
              <>
                남은 재료로,
                <br />
                오늘 한 끼
              </>
            ) : (
              '남은 재료로, 오늘 한 끼'
            )}
          </h2>
        </div>
        {!savedJobId && (
          <Button disabled={disabled} onClick={() => void state.start()}>
            {state.submitting
              ? '요청 접수 중…'
              : working
                ? '추천 중…'
                : job || state.error
                  ? '다시 추천 받기'
                  : '요리 추천 받기'}
            {compact && <span aria-hidden="true">→</span>}
          </Button>
        )}
      </header>
      <p className="recipe-quantity-note">
        보유한 재료 종류를 기준으로 찾아요. 필요한 양은 따로 확인해 주세요.
      </p>
      <div className="recipe-history-links">
        <Link href="/recipes/history">추천 내역</Link>
        {savedJobId && <Link href={'/fridges/' + fridgeId}>냉장고로 돌아가기</Link>}
      </div>
      {!online && (
        <p className="connection-banner" role="status">
          온라인으로 연결하면 추천 상태를 다시 확인해요. 접수한 작업은 계속 진행돼요.
        </p>
      )}
      {loading ? (
        <p className="recipe-feedback" role="status">
          현재 냉장고 재료를 확인하고 있어요…
        </p>
      ) : inventoryError ? (
        <p className="recipe-feedback" role="status">
          재료 목록을 다시 불러온 뒤 추천받아 주세요.
        </p>
      ) : (
        !usable.length &&
        !savedJobId && (
          <div className="recipe-empty">
            <h3>추천에 쓸 재료가 아직 없어요</h3>
            <p>
              남은 양이 있는 재료를 등록해 주세요. 0%이거나 기한이 지난 묶음은 추천에서 제외해요.
            </p>
          </div>
        )
      )}
      {stale && (
        <p className="recipe-feedback" role="status">
          추천을 요청한 뒤 재료나 날짜가 바뀌었어요. 아래 요리는 요청 당시 재료를 기준으로 해요.
        </p>
      )}
      {state.submitting && (
        <p className="recipe-feedback" role="status">
          추천 요청을 저장하고 있어요…
        </p>
      )}
      {working && (
        <div className="recipe-job-status" role="status">
          <strong>
            {matches.length
              ? '먼저 준비된 요리부터 확인해 보세요'
              : '현재 재료로 만들 요리를 찾고 있어요'}
          </strong>
          <p>화면을 나가도 추천은 계속돼요. 완료한 요리는 추천 내역에 저장해요.</p>
          <p>알림 받기가 켜져 있고 이 기기에 연결돼 있으면 완료 알림도 보내요.</p>
          <progress aria-label="요리 추천 진행 중" />
        </div>
      )}
      {state.error && (
        <div className="recipe-error">
          <p role="alert">{state.error}</p>
          <p>보관 중인 재료와 남은 양은 바뀌지 않았어요.</p>
          <Button variant="secondary" onClick={() => void state.refresh()}>
            상태 다시 확인
          </Button>
        </div>
      )}
      {job?.status === 'failed' && (
        <div className="recipe-error" role="alert">
          요리 추천을 완료하지 못했어요. 잠시 후 다시 추천받아 주세요.
        </div>
      )}
      {job?.status === 'cancelled' && (
        <p role="alert">냉장고 권한이 변경되어 이 추천을 중단했어요.</p>
      )}
      {job?.status === 'complete' && matches.length === 0 && (
        <div className="recipe-empty">
          <h3>겹치는 재료의 요리를 찾지 못했어요</h3>
          <p>재료를 더 등록하거나 잠시 후 다시 추천받아 보세요.</p>
        </div>
      )}
      {job?.status === 'complete' && matches.length > 0 && (
        <p className="recipe-feedback" role="status">
          추천이 완료되어 내역에 저장했어요.
        </p>
      )}
      {matches.length > 0 &&
        (['available', 'needs-shopping'] as const).map((kind) => {
          const group = matches.filter((item) => item.kind === kind);
          return (
            <section className="recipe-group" key={kind} aria-labelledby={headingId + kind}>
              <header>
                <h3 id={headingId + kind}>
                  {kind === 'available' ? '보유 재료로 만들어요' : '조금만 더 사면 만들어요'}
                  <span>{group.length}개</span>
                </h3>
              </header>
              {group.length === 0 ? (
                <p className="recipe-group-empty">이 분류의 추천은 아직 없어요.</p>
              ) : (
                <div className="recipe-cards">
                  {(compact ? group.slice(0, 2) : group).map((item) => (
                    <article className="recipe-card" key={item.recipe.id}>
                      {item.urgentIngredientIds.length > 0 && (
                        <p className="recipe-urgency">
                          임박 재료 {item.urgentIngredientIds.length}종 활용
                        </p>
                      )}
                      <h4>{item.recipe.name}</h4>
                      <p className="recipe-card-meta">{recipeMetadata(item.recipe)}</p>
                      {item.missing.length > 0 && (
                        <p className="recipe-missing">추가할 재료: {item.missing.join(', ')}</p>
                      )}
                      <Button
                        variant="secondary"
                        onClick={() => setSelectedId(item.recipe.id)}
                        aria-label={item.recipe.name + ' 조리법 보기'}
                      >
                        재료·조리법 보기 <span aria-hidden="true">↗</span>
                      </Button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      {selected && job && (
        <RecipeDetail
          match={selected}
          ingredients={job.ingredients}
          onClose={() => setSelectedId(null)}
        />
      )}
    </section>
  );
}
