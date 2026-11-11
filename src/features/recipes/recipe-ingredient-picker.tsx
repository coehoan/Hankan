'use client';
import { useId, useState, type ReactNode } from 'react';
import type { Ingredient } from '@/features/inventory/contracts';
import { Button } from '@/components/ui/button';
import { normalizeIngredientName, usableIngredients } from './domain';

export function RecipeIngredientPicker({
  ingredients,
  today,
  disabled,
  loading,
  actionLabel,
  onSubmit,
  resolving = false,
}: {
  ingredients: Ingredient[];
  today: string;
  disabled: boolean;
  resolving?: boolean;
  loading: boolean;
  actionLabel: ReactNode;
  onSubmit: (ids?: string[]) => void;
}) {
  const id = useId();
  const [mode, setMode] = useState<'all' | 'selected'>('all');
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(12);
  const [notice, setNotice] = useState('');
  const groups = new Map<string, { name: string; expiresOn: string; ids: string[] }>();
  for (const item of usableIngredients(ingredients, today).sort(
    (a, b) =>
      a.expiresOn.localeCompare(b.expiresOn) ||
      a.name.localeCompare(b.name, 'ko-KR') ||
      a.id.localeCompare(b.id),
  )) {
    const name = normalizeIngredientName(item.name);
    const group = groups.get(name);
    if (group) group.ids.push(item.id);
    else groups.set(name, { name: item.name, expiresOn: item.expiresOn, ids: [item.id] });
  }
  const validNames = selectedNames.filter((name) => groups.has(name));
  // Reconcile this component's draft before committing a render after shared inventory changes.
  if (!loading && validNames.length !== selectedNames.length) {
    setSelectedNames(validNames);
    setNotice('사용할 수 없게 된 재료를 선택에서 제외했어요.');
  }
  const selectedIds = validNames.flatMap((name) => groups.get(name)!.ids).sort();
  const filtered = [...groups].filter(([, group]) =>
    normalizeIngredientName(group.name).includes(normalizeIngredientName(query)),
  );
  const selectionDisabled = !selectedIds.length || selectedIds.length > 1000;
  const locked = disabled || resolving;
  return (
    <div className="recipe-selection">
      <fieldset className="recipe-modes" disabled={locked}>
        <legend className="sr-only">추천 방식</legend>
        {(['all', 'selected'] as const).map((value) => (
          <label key={value}>
            <input
              type="radio"
              name={id + '-mode'}
              checked={mode === value}
              onChange={() => setMode(value)}
            />
            <span>{value === 'all' ? '전체 재료' : '재료 골라서'}</span>
          </label>
        ))}
      </fieldset>
      {mode === 'selected' && (
        <div className="recipe-selection-panel">
          <div className="recipe-selection-heading">
            <div>
              <h3>어떤 재료를 먼저 쓸까요?</h3>
              <p>고른 재료를 중심으로, 다른 보유 재료도 함께 활용해요.</p>
            </div>
            <label className="recipe-selection-search">
              <span className="sr-only">재료 검색</span>
              <input
                type="search"
                placeholder="재료 검색"
                value={query}
                disabled={locked}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setLimit(12);
                }}
              />
            </label>
          </div>
          <div className="recipe-selection-summary">
            <strong>추천에 쓸 재료</strong>
            <span role="status">
              {validNames.length}종 선택{notice ? ' · ' + notice : ''}
            </span>
            <Button
              variant="ghost"
              disabled={locked || !validNames.length}
              onClick={() => {
                setSelectedNames([]);
                setNotice('');
              }}
            >
              선택 해제
            </Button>
          </div>
          <div className="recipe-selection-chips">
            {filtered.slice(0, limit).map(([key, group]) => (
              <button
                className="recipe-selection-chip"
                type="button"
                key={key}
                aria-label={group.name + ' 선택'}
                aria-pressed={validNames.includes(key)}
                disabled={locked}
                onClick={() => {
                  setSelectedNames((names) =>
                    names.includes(key) ? names.filter((name) => name !== key) : [...names, key],
                  );
                  setNotice('');
                }}
              >
                <span className="recipe-selection-tick" aria-hidden="true">
                  {validNames.includes(key) ? '✓' : ''}
                </span>
                <span>
                  <strong>{group.name}</strong>
                  <small>{group.expiresOn}까지</small>
                </span>
              </button>
            ))}
          </div>
          {!filtered.length && (
            <p className="recipe-selection-hint">
              {loading
                ? '재료를 확인하고 있어요…'
                : query
                  ? '검색한 재료가 없어요.'
                  : '선택할 수 있는 재료가 없어요.'}
            </p>
          )}
          {filtered.length > limit && (
            <Button
              variant="ghost"
              disabled={locked}
              onClick={() => setLimit((value) => value + 12)}
            >
              재료 더 보기
            </Button>
          )}
          <div className="recipe-selection-actions">
            <p>
              {validNames.length
                ? validNames.map((name) => groups.get(name)!.name).join(' · ')
                : '추천에 활용할 재료를 골라 주세요.'}
            </p>
            <Button disabled={disabled || selectionDisabled} onClick={() => onSubmit(selectedIds)}>
              {disabled ? actionLabel : '선택한 재료로 추천받기'}
            </Button>
          </div>
          <p className="recipe-selection-hint">
            {selectedIds.length > 1000
              ? '선택한 재료의 재고가 너무 많아요. 선택을 줄여 주세요.'
              : '각 요리는 고른 재료를 하나 이상 활용해요.'}
          </p>
        </div>
      )}
      {mode === 'all' && (
        <div className="recipe-selection-all">
          <Button disabled={disabled} onClick={() => onSubmit()}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
