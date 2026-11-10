'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, RefCallback } from 'react';
import type { Ingredient, StoragePlace } from './contracts';
import { sortIngredients, urgencyOf } from './domain';
import { useInventory } from './use-inventory';
import { IngredientForm } from './ingredient-form';
import { IngredientArt } from './ingredient-art';
import { IngredientGroup, ingredientGroups } from './ingredient-group';
import { InventoryNotice } from './inventory-notice';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { PantryIcon } from '@/components/ui/pantry-icon';

const storageNames: Record<StoragePlace, string> = {
  fridge: '냉장',
  freezer: '냉동',
  pantry: '실온',
};
function daysLeft(date: string, today: string) {
  return Math.round(
    (Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000,
  );
}
function dateInZone(zone: string) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts();
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join('-');
}

function IngredientRow({
  item,
  today,
  disabled,
  saving,
  rowRef,
  onEdit,
  onUpdate,
  onDelete,
}: {
  item: Ingredient;
  today: string;
  disabled: boolean;
  saving: boolean;
  rowRef: RefCallback<HTMLElement>;
  onEdit: () => void;
  onUpdate: (value: number) => Promise<void>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<{ version: number; value: number } | null>(null),
    inFlight = useRef(false);
  const value = draft?.version === item.version ? draft.value : item.remainingPercent;
  const left = daysLeft(item.expiresOn, today),
    urgency = urgencyOf(item.expiresOn, today);
  async function commit() {
    if (inFlight.current || disabled) return;
    const next = value;
    if (next === item.remainingPercent) {
      setDraft(null);
      return;
    }
    inFlight.current = true;
    try {
      await onUpdate(next);
    } catch {
      /* The screen displays the request failure and retry. */
    } finally {
      inFlight.current = false;
      setDraft(null);
    }
  }
  return (
    <article ref={rowRef} className="ingredient-row" tabIndex={-1}>
      <button
        className="ingredient-main"
        aria-label={item.name + ' 수정'}
        onClick={onEdit}
        disabled={disabled}
      >
        <span className="ingredient-symbol" aria-hidden="true">
          <IngredientArt name={item.name} />
        </span>
        <span className="ingredient-copy">
          <span className="ingredient-name">{item.name}</span>
          <span className="ingredient-meta">{storageNames[item.storage]}</span>
          <span className="ingredient-date">
            <strong className={'expiry-badge ' + urgency}>
              {left < 0 ? `${-left}일 지남` : left === 0 ? '오늘까지' : `${left}일 남음`}
            </strong>
            <time dateTime={item.expiresOn} title={item.expiresOn}>
              {item.expiresOn.slice(0, 4) === today.slice(0, 4)
                ? `${Number(item.expiresOn.slice(5, 7))}월 ${Number(item.expiresOn.slice(8, 10))}일`
                : item.expiresOn.replaceAll('-', '.')}
            </time>
          </span>
        </span>
      </button>
      <div className="ingredient-quantity" aria-busy={saving}>
        <label htmlFor={'quantity-' + item.id}>남은 양</label>
        <input
          id={'quantity-' + item.id}
          aria-label={item.name + ' 남은 양'}
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          disabled={disabled}
          onChange={(event) =>
            setDraft({ version: item.version, value: Number(event.target.value) })
          }
          onPointerUp={() => void commit()}
          onBlur={() => void commit()}
          onKeyUp={(event) => {
            if (
              [
                'ArrowLeft',
                'ArrowRight',
                'ArrowUp',
                'ArrowDown',
                'Home',
                'End',
                'PageUp',
                'PageDown',
              ].includes(event.key)
            )
              void commit();
          }}
        />
        <output>{value}%</output>
      </div>
      <div className="quantity-save-slot">
        {saving && (
          <div
            className="quantity-save-progress"
            role="progressbar"
            aria-label={item.name + ' 남은 양 저장 중'}
          >
            <span />
          </div>
        )}
      </div>
      <div className="ingredient-tools">
        <button
          className="edit-ingredient"
          aria-label={item.name + ' 기한 수정'}
          onClick={onEdit}
          disabled={disabled}
        >
          기한 수정
        </button>
        <button
          className="delete-ingredient"
          aria-label={item.name + ' 삭제'}
          onClick={onDelete}
          disabled={disabled}
        >
          삭제
        </button>
      </div>
    </article>
  );
}

type Editor = { fridgeId: string; item?: Ingredient; fallbackFocus?: () => HTMLElement | null };
export function InventoryScreen({
  fridgeId,
  fridgeName,
  initialToday,
  timeZone = 'Asia/Seoul',
  onAccessLost,
  onReceiptUpload,
  fridgeControl,
}: {
  fridgeId: string;
  fridgeName: string;
  initialToday: string;
  timeZone?: string;
  onAccessLost?: () => void;
  onReceiptUpload?: () => void;
  fridgeControl?: ReactNode;
}) {
  const inventory = useInventory(fridgeId);
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState<StoragePlace | 'all'>('all'),
    [editor, setEditor] = useState<Editor | null>(null),
    [notice, setNotice] = useState({ id: 0, message: '' }),
    [today, setToday] = useState(initialToday);
  const searchInput = useRef<HTMLInputElement>(null);
  const getSearchInput = useCallback(() => searchInput.current, []);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const dismissNotice = useCallback(
    () => setNotice((current) => ({ ...current, message: '' })),
    [],
  );
  function showNotice(message: string) {
    setNotice((current) => ({ id: current.id + 1, message }));
  }
  useEffect(() => {
    const timer = setInterval(() => setToday(dateInZone(timeZone)), 30_000);
    return () => clearInterval(timer);
  }, [timeZone]);
  useEffect(() => {
    if (inventory.revoked) onAccessLost?.();
  }, [inventory.revoked, onAccessLost]);
  const activeEditor = editor?.fridgeId === fridgeId ? editor : null;
  const sorted = sortIngredients(inventory.items, today);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const searchKey = normalizedQuery ? filter + ':' + normalizedQuery : null;
  const visible = sorted.filter(
    (item) =>
      (filter === 'all' || item.storage === filter) &&
      item.name.toLocaleLowerCase().includes(normalizedQuery),
  );
  const grouped: Record<(typeof ingredientGroups)[number]['key'], Ingredient[]> = {
    expired: [],
    soon: [],
    normal: [],
  };
  for (const item of visible) grouped[urgencyOf(item.expiresOn, today)].push(item);
  const busy = inventory.pendingId !== null,
    disabled = busy || !inventory.online;
  const expired = sorted.filter((item) => urgencyOf(item.expiresOn, today) === 'expired').length;
  const soon = sorted.filter((item) => urgencyOf(item.expiresOn, today) === 'soon');
  if (inventory.revoked)
    return (
      <section className="inventory-message" role="alert">
        <h1>냉장고 접근 권한이 변경됐어요</h1>
        <p>접근 가능한 내 냉장고로 이동합니다.</p>
      </section>
    );
  return (
    <main className="inventory-page">
      <div className="inventory-intro">
        <div>
          <p className="workspace-kicker">식재료 관리</p>
          <div className="inventory-heading">
            <h1>{fridgeName}</h1>
            {fridgeControl}
          </div>
          <p className="inventory-subtitle">보관 중인 재료와 먼저 써야 할 재료를 확인해요.</p>
        </div>
        <div className="inventory-add-actions">
          <button
            className="add-button"
            onClick={() => {
              setEditor({ fridgeId });
              showNotice('');
            }}
            disabled={disabled}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            직접 등록
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              showNotice('');
              onReceiptUpload?.();
            }}
            disabled={disabled || !onReceiptUpload}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z M9 8h6M9 12h6" />
            </svg>
            영수증 등록
          </button>
        </div>
      </div>
      <section className="inventory-overview" aria-label="냉장고 요약">
        <dl>
          <div>
            <dt>
              <PantryIcon name="fridge" /> 전체 재료
            </dt>
            <dd>{inventory.loading ? '–' : inventory.items.length}</dd>
          </div>
          <div>
            <dt>
              <PantryIcon name="alert" /> 3일 이내
            </dt>
            <dd>{inventory.loading ? '–' : soon.length}</dd>
          </div>
          <div>
            <dt>
              <PantryIcon name="alert" /> 기한 지남
            </dt>
            <dd>{inventory.loading ? '–' : expired}</dd>
          </div>
        </dl>
        <p>
          <time dateTime={today}>{today.replaceAll('-', '.')}</time> 기준
        </p>
      </section>
      {addingFor === fridgeId && (
        <Dialog
          open
          title="재료 등록 방법"
          onOpenChange={(open) => {
            if (!open) setAddingFor(null);
          }}
        >
          <p className="muted">재료를 어떻게 등록할까요?</p>
          <div className="registration-methods">
            <button
              className="settings-row"
              disabled={disabled}
              onClick={() => {
                setAddingFor(null);
                setEditor({ fridgeId });
              }}
            >
              <span>직접 입력</span>
            </button>
            <button
              className="settings-row"
              disabled={disabled || !onReceiptUpload}
              onClick={() => {
                setAddingFor(null);
                onReceiptUpload?.();
              }}
            >
              <span>영수증 등록</span>
            </button>
          </div>
        </Dialog>
      )}
      {!inventory.online && (
        <p className="connection-banner" role="status">
          오프라인이에요. 연결이 돌아오면 최신 목록을 확인하고 저장할 수 있어요.
        </p>
      )}
      {activeEditor && (
        <IngredientForm
          key={`${fridgeId}:${activeEditor.item?.id ?? 'new'}:${activeEditor.item?.version ?? 0}`}
          item={activeEditor.item}
          latestItem={inventory.items.find((item) => item.id === activeEditor.item?.id)}
          online={inventory.online}
          create={inventory.create}
          update={inventory.update}
          fallbackFocus={activeEditor.fallbackFocus}
          onCancel={() => setEditor(null)}
          onComplete={() => {
            setEditor((current) => (current?.fridgeId === fridgeId ? null : current));
            showNotice('재료를 저장했어요.');
          }}
          onReload={() => {
            const latest = inventory.items.find((item) => item.id === activeEditor.item?.id);
            if (latest) setEditor({ ...activeEditor, item: latest });
          }}
        />
      )}
      <div className="inventory-columns">
        <div className="inventory-list-column">
          <div className="inventory-list-heading">
            <h2 className="inventory-list-title">재료 목록</h2>
            <Button
              variant="ghost"
              className="inventory-refresh-button"
              aria-label="새로고침"
              onClick={() => void inventory.refresh()}
              disabled={!inventory.online || busy}
            >
              <PantryIcon name="refresh" />
            </Button>
          </div>
          <div className="inventory-tools">
            <div className="storage-filters" role="group" aria-label="보관 장소 필터">
              {(['all', 'fridge', 'freezer', 'pantry'] as const).map((place) => (
                <button
                  key={place}
                  aria-pressed={filter === place}
                  onClick={() => setFilter(place)}
                >
                  {place === 'all' ? '전체' : storageNames[place]}
                </button>
              ))}
            </div>
            <label className="inventory-search">
              <input
                ref={searchInput}
                type="search"
                aria-label="재료 이름 검색"
                placeholder="재료 검색"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
            </label>
          </div>
          {inventory.error && !activeEditor && (
            <div className="inventory-error">
              <p role="alert">{inventory.error.message}</p>
              <button
                className="text-button"
                onClick={() => void inventory.refresh()}
                disabled={!inventory.online || busy}
              >
                다시 불러오기
              </button>
            </div>
          )}
          {notice.message && (
            <InventoryNotice key={notice.id} message={notice.message} onClose={dismissNotice} />
          )}
          {inventory.loading ? (
            <div className="inventory-loading" role="status">
              냉장고를 살펴보고 있어요…
              <span />
              <span />
              <span />
            </div>
          ) : inventory.error && inventory.items.length === 0 ? (
            <section className="empty-inventory">
              <h2>목록을 확인하지 못했어요</h2>
              <p>연결을 확인한 뒤 다시 불러와 주세요. 저장된 재료는 그대로 남아 있어요.</p>
            </section>
          ) : visible.length === 0 ? (
            <section className="empty-inventory">
              <span className="empty-leaf">
                <PantryIcon name="fridge" />
              </span>
              <h2>
                {inventory.items.length ? '찾는 재료가 없어요' : '냉장고의 첫 재료를 담아 보세요'}
              </h2>
              <p>
                {inventory.items.length
                  ? '이름이나 보관 장소를 바꿔서 찾아보세요.'
                  : '이름과 유통기한을 적어두면 무엇을 먼저 먹을지 한눈에 보여요.'}
              </p>
              {inventory.items.length ? (
                <button
                  className="secondary-button"
                  onClick={() => {
                    setFilter('all');
                    setQuery('');
                  }}
                >
                  필터 초기화
                </button>
              ) : null}
            </section>
          ) : null}
          {ingredientGroups.map((group) => (
            <IngredientGroup
              key={group.key}
              group={group}
              rows={grouped[group.key]}
              searchKey={searchKey}
              getListFocusFallback={getSearchInput}
              renderRow={(item, toggleId, rowRef) => (
                <IngredientRow
                  key={item.id}
                  item={item}
                  today={today}
                  disabled={disabled}
                  saving={inventory.pendingId === item.id}
                  rowRef={rowRef}
                  onEdit={() => {
                    setEditor({
                      fridgeId,
                      item,
                      fallbackFocus: () => document.getElementById(toggleId) ?? getSearchInput(),
                    });
                    showNotice('');
                  }}
                  onUpdate={async (value) => {
                    await inventory.update(item.id, item.version, {
                      remainingPercent: value,
                    });
                    showNotice('남은 양을 저장했어요.');
                  }}
                  onDelete={() => {
                    showNotice('');
                    void inventory
                      .remove(item.id, item.version)
                      .then(() => showNotice('재료를 삭제했어요.'))
                      .catch(() => {});
                  }}
                />
              )}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
