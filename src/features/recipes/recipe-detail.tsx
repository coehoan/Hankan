'use client';
import { Dialog } from '@/components/ui/dialog';
import type { Ingredient } from '@/features/inventory/contracts';
import type { RecipeMatch } from './domain';
import { normalizeIngredientName } from './domain';
import { recipeMetadata } from './recipe-metadata';
export function RecipeDetail({
  match,
  ingredients,
  onClose,
}: {
  match: RecipeMatch;
  ingredients: Ingredient[];
  onClose: () => void;
}) {
  const { recipe } = match,
    missing = new Set(match.missing.map(normalizeIngredientName));
  const urgent = match.urgentIngredientIds.flatMap((id) => {
    const item = ingredients.find((item) => item.id === id);
    return item ? [item] : [];
  });
  return (
    <Dialog
      open
      title={recipe.name}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <article className="recipe-detail">
        <p className="recipe-detail-meta">{recipeMetadata(recipe)}</p>
        <p className="recipe-quantity-note">
          보유 여부는 재료 종류 기준이에요. 필요한 양과 남은 양을 확인해 주세요.
        </p>
        {urgent.length > 0 && (
          <section className="recipe-urgent">
            <h3>이 묶음부터 사용해 보세요</h3>
            <ul>
              {urgent.map((item) => (
                <li key={item.id}>
                  <strong>{item.name}</strong>
                  <span>
                    <time dateTime={item.expiresOn}>{item.expiresOn.replaceAll('-', '.')}까지</time>{' '}
                    · 남은 양 {item.remainingPercent}%
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h3>필요한 재료와 양</h3>
          {recipe.ingredientsText && (
            <p style={{ whiteSpace: 'pre-line' }}>
              {recipe.ingredientsText.replace(/<br\s*\/?>/giu, '\n')}
            </p>
          )}
          <ul className="recipe-ingredients">
            {recipe.ingredients.map((item, index) => (
              <li key={index}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.amountText}</span>
                </div>
                {missing.has(normalizeIngredientName(item.name)) && (
                  <span className="recipe-missing-tag">추가 구매</span>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3>순서대로 만들어 보세요</h3>
          <ol className="recipe-steps">
            {recipe.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </section>
      </article>
    </Dialog>
  );
}
