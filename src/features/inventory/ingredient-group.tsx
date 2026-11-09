import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefCallback } from 'react';
import type { Ingredient } from './contracts';

export const ingredientGroups = [
  { key: 'expired', label: '기한 지남', sub: '상태를 확인해 주세요' },
  { key: 'soon', label: '먼저 먹어요', sub: '기한이 가까운 순' },
  { key: 'normal', label: '조금 더 여유 있어요', sub: '신선함을 오래오래' },
] as const;

const pageSize = 5;
const initialSearchView = { open: true, limit: pageSize };
type GroupView = typeof initialSearchView;

export function IngredientGroup({
  group,
  rows,
  searchKey,
  getListFocusFallback,
  renderRow,
}: {
  group: (typeof ingredientGroups)[number];
  rows: Ingredient[];
  searchKey: string | null;
  getListFocusFallback: () => HTMLElement | null;
  renderRow: (item: Ingredient, toggleId: string, rowRef: RefCallback<HTMLElement>) => ReactNode;
}) {
  const id = useId();
  const toggleId = id + '-toggle';
  const panel = useRef<HTMLDivElement>(null);
  const nextRowIndex = useRef<number | null>(null);
  const removedWithFocus = useRef<HTMLElement | null>(null);
  const trackFocusOnRemoval = useCallback<RefCallback<HTMLElement>>((element) => {
    if (!element) return;
    return () => {
      if (element.contains(document.activeElement)) removedWithFocus.current = element;
    };
  }, []);
  const [normal, setNormal] = useState({ open: group.key !== 'normal', limit: pageSize });
  const [search, setSearch] = useState<(GroupView & { key: string }) | null>(null);
  if (search && search.key !== searchKey) {
    setSearch(null);
  } else if (search && !search.open && rows.length === 0) {
    // A group that gains matches again opens without losing its requested row count.
    setSearch({ ...search, open: true });
  }

  const view = searchKey ? (search?.key === searchKey ? search : initialSearchView) : normal;
  function setView(next: GroupView) {
    if (searchKey) setSearch({ ...next, key: searchKey });
    else setNormal(next);
  }

  useLayoutEffect(() => {
    const removed = removedWithFocus.current;
    removedWithFocus.current = null;
    const index = nextRowIndex.current;
    nextRowIndex.current = null;
    const row = index === null ? null : panel.current?.children.item(index);
    if (row instanceof HTMLElement) row.focus();
    // Only restore focus if the removed element left focus on the body.
    if (removed && !removed.isConnected && document.activeElement === document.body)
      (document.getElementById(toggleId) ?? getListFocusFallback())?.focus();
  });

  if (!rows.length) return null;
  return (
    <section
      ref={trackFocusOnRemoval}
      className={'ingredient-group ' + group.key}
      aria-labelledby={id + '-heading'}
    >
      <header>
        <h2 id={id + '-heading'}>
          <button
            id={toggleId}
            type="button"
            className="ingredient-group-toggle"
            aria-label={`${group.label} ${rows.length}개`}
            aria-expanded={view.open}
            aria-controls={id + '-panel'}
            onClick={() => setView({ ...view, open: !view.open })}
          >
            {group.label}
            <span>{rows.length}</span>
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="m4 6 4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </h2>
        <p>{group.sub}</p>
      </header>
      <div ref={panel} id={id + '-panel'} className="ingredient-group-panel" hidden={!view.open}>
        {view.open &&
          rows.slice(0, view.limit).map((item) => renderRow(item, toggleId, trackFocusOnRemoval))}
        {view.open && rows.length > view.limit && (
          <button
            ref={trackFocusOnRemoval}
            type="button"
            className="secondary-button ingredient-group-more"
            aria-label={group.label + ' 더 보기'}
            onClick={() => {
              nextRowIndex.current = view.limit;
              setView({ ...view, limit: view.limit + pageSize });
            }}
          >
            더 보기
          </button>
        )}
      </div>
    </section>
  );
}
