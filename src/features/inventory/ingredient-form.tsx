'use client';
import { useId, useRef, useState } from 'react';
import type { CreateIngredientInput, Ingredient, IngredientPatch, StoragePlace } from './contracts';
import { parseCreateIngredient, parseIngredientPatch } from './domain';
import { InventoryRequestError } from './use-inventory';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type Props = {
  item?: Ingredient;
  latestItem?: Ingredient;
  online: boolean;
  create: (input: CreateIngredientInput) => Promise<Ingredient>;
  update: (id: string, version: number, patch: IngredientPatch) => Promise<Ingredient>;
  onComplete: () => void;
  onCancel: () => void;
  onReload: () => void;
};
export function IngredientForm({
  item,
  latestItem,
  online,
  create,
  update,
  onComplete,
  onCancel,
  onReload,
}: Props) {
  const [name, setName] = useState(item?.name ?? ''),
    [storage, setStorage] = useState<StoragePlace>(item?.storage ?? 'fridge'),
    [expiresOn, setExpiresOn] = useState(item?.expiresOn ?? '');
  const [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const saving = useRef(false),
    request = useRef<{ signature: string; id: string } | null>(null);
  const hintId = useId();
  const title = item ? '재료 수정' : '재료 등록';
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || !online) return;
    saving.current = true;
    setPending(true);
    setError('');
    try {
      if (item)
        await update(item.id, item.version, parseIngredientPatch({ name, storage, expiresOn }));
      else {
        const signature = JSON.stringify({ name: name.trim(), storage, expiresOn });
        if (request.current?.signature !== signature)
          request.current = { signature, id: crypto.randomUUID() };
        await create(
          parseCreateIngredient({ requestId: request.current.id, name, storage, expiresOn }),
        );
      }
      onComplete();
    } catch (caught) {
      setError(
        caught instanceof InventoryRequestError && caught.code === 'conflict'
          ? '다른 사람이 먼저 변경했어요. 입력한 내용은 남겨뒀어요. 최신 저장값을 확인해 주세요.'
          : caught instanceof Error
            ? caught.message
            : '저장하지 못했어요. 다시 시도해 주세요.',
      );
    } finally {
      saving.current = false;
      setPending(false);
    }
  }
  return (
    <Dialog
      open
      title={title}
      onOpenChange={(open) => {
        if (!open && !saving.current) onCancel();
      }}
      closeDisabled={pending}
    >
      <section className="ingredient-editor">
        <div className="editor-heading">
          <span className="editor-hint">한 묶음씩, 차곡차곡</span>
        </div>
        <form aria-label={title} onSubmit={submit}>
          <div className="ingredient-fields">
            <label className="field">
              재료 이름
              <input
                aria-label="재료 이름"
                aria-describedby={hintId}
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="예: 방울토마토"
                required
                maxLength={160}
                disabled={pending}
              />
              <span id={hintId} className="field-hint">
                {[...name].length}/80자 · 같은 재료도 묶음별로 관리해요.
              </span>
            </label>
            <label className="field">
              보관 장소
              <select
                name="storage"
                value={storage}
                onChange={(event) => setStorage(event.target.value as StoragePlace)}
                disabled={pending}
              >
                <option value="fridge">냉장</option>
                <option value="freezer">냉동</option>
                <option value="pantry">실온</option>
              </select>
            </label>
            <label className="field">
              유통기한
              <input
                name="expiresOn"
                type="date"
                min="0001-01-01"
                max="9999-12-31"
                value={expiresOn}
                onChange={(event) => setExpiresOn(event.target.value)}
                required
                disabled={pending}
              />
            </label>
          </div>
          {error && (
            <div className="editor-error">
              <p role="alert">{error}</p>
              {item && latestItem && latestItem.version !== item.version && (
                <>
                  <button type="button" className="text-button" onClick={onReload}>
                    최신 내용 불러오기
                  </button>
                  <span>입력한 내용을 최신 저장값으로 바꿔요.</span>
                </>
              )}
            </div>
          )}
          <div className="editor-actions">
            <p>
              {!online
                ? '연결이 돌아오면 저장할 수 있어요. 입력은 유지돼요.'
                : item
                  ? '현재 저장된 버전을 확인한 뒤 수정해요.'
                  : '남은 양은 100%로 시작해요.'}
            </p>
            <Button variant="secondary" onClick={onCancel} disabled={pending}>
              취소
            </Button>
            <Button type="submit" disabled={pending || !online}>
              {pending ? '저장 중…' : '저장'}
            </Button>
          </div>
        </form>
      </section>
    </Dialog>
  );
}
