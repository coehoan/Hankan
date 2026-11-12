'use client';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Ingredient } from '@/features/inventory/contracts';
import { inventoryVersion, usableIngredients } from './domain';
import { RecipeDetail } from './recipe-detail';
import { recipeMetadata } from './recipe-metadata';
import { recipeJobPending } from './job-contracts';
import { useRecipeJob } from './use-recipe-job';
import { PantryIcon } from '@/components/ui/pantry-icon';
import { RecipeIngredientPicker } from './recipe-ingredient-picker';
import { recipeCondition } from './recipe-condition';
import { RecipeJobStatus } from './recipe-job-status';
type Props = {
  fridgeId: string;
  ingredients: Ingredient[];
  today: string;
  online: boolean;
  loading: boolean;
  revoked: boolean;
  pending?: boolean;
  inventoryError?: boolean;
  onReloadInventory?: () => void;
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
  onReloadInventory,
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
            {savedJobId ? '추천 결과' : compact ? '남은 재료로 한 끼' : '내 재료로 요리 찾기'}
          </h2>
        </div>
        {!savedJobId && compact && (
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
      {!savedJobId && !compact && (
        <RecipeIngredientPicker
          key={fridgeId}
          ingredients={ingredients}
          today={today}
          disabled={disabled}
          loading={loading}
          resolving={state.resolving}
          actionLabel={
            state.submitting
              ? '요청 접수 중…'
              : working
                ? '추천 중…'
                : job || state.error
                  ? '다시 추천 받기'
                  : '요리 추천 받기'
          }
          onSubmit={(ids) => void state.start(ids)}
        />
      )}
      {job && <p className="recipe-request-condition">{recipeCondition(job)}</p>}
      {!savedJobId && !working && (
        <p className="recipe-quantity-note">
          물은 기본으로 있어요. 나머지는 보유한 재료 종류를 기준으로 찾으니 필요한 양을 확인해
          주세요.
        </p>
      )}
      {!online && (
        <p className="connection-banner" role="status">
          온라인으로 연결하면 추천 상태를 다시 확인해요. 접수한 작업은 계속 진행돼요.
        </p>
      )}
      {!savedJobId &&
        (loading ? (
          <p className="recipe-feedback" role="status">
            현재 냉장고 재료를 확인하고 있어요…
          </p>
        ) : inventoryError ? (
          <div className="recipe-error">
            <p role="alert">현재 재료를 확인하지 못했어요.</p>
            <Button variant="secondary" disabled={!online} onClick={onReloadInventory}>
              재료 다시 불러오기
            </Button>
          </div>
        ) : null)}
      {!savedJobId && stale && (
        <p className="recipe-feedback" role="status">
          추천을 요청한 뒤 재료나 날짜가 바뀌었어요. 아래 요리는 요청 당시 재료를 기준으로 해요.
        </p>
      )}
      {!savedJobId && state.submitting && (
        <p className="recipe-feedback" role="status">
          추천 요청을 저장하고 있어요…
        </p>
      )}
      {working && <RecipeJobStatus hasResults={matches.length > 0} />}
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
          <h3>
            {job.selectedIngredientIds
              ? '고른 재료로 추천할 요리를 찾지 못했어요'
              : '겹치는 재료의 요리를 찾지 못했어요'}
          </h3>
          <p>
            {job.selectedIngredientIds
              ? '선택한 재료를 바꾸거나 전체 재료로 추천받아 보세요.'
              : '재료를 더 등록하거나 잠시 후 다시 추천받아 보세요.'}
          </p>
        </div>
      )}
      {!savedJobId && job?.status === 'complete' && matches.length > 0 && (
        <p className="recipe-feedback" role="status">
          추천이 완료되어 내역에 저장했어요.
        </p>
      )}
      {matches.length > 0 &&
        (['available', 'needs-shopping'] as const).map((kind) => {
          const group = matches.filter((item) => item.kind === kind);
          if (!group.length) return null;
          return (
            <section className="recipe-group" key={kind} aria-labelledby={headingId + kind}>
              <header>
                <h3 id={headingId + kind}>
                  <PantryIcon name={kind === 'available' ? 'check' : 'bowl'} />
                  {kind === 'available' ? '보유 재료로 만들어요' : '조금만 더 사면 만들어요'}
                  <span>{group.length}개</span>
                </h3>
              </header>
              {
                <div className="recipe-cards">
                  {(compact ? group.slice(0, 2) : group).map((item) => (
                    <article className="recipe-card" key={item.recipe.id}>
                      <div className="recipe-card-copy">
                        <h4>{item.recipe.name}</h4>
                        <p className="recipe-card-meta">{recipeMetadata(item.recipe)}</p>
                        {item.urgentIngredientIds.length > 0 && (
                          <p className="recipe-urgency">
                            임박 재료 {item.urgentIngredientIds.length}종 활용
                          </p>
                        )}
                        {item.missing.length > 0 && (
                          <p className="recipe-missing">추가할 재료: {item.missing.join(', ')}</p>
                        )}
                      </div>
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
              }
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
