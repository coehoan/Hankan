'use client';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { parseFridgeName } from './fridge-name';
export function RenameFridgeDialog({
  fridgeId,
  name,
  onClose,
  onSaved,
  onAccessLost,
}: {
  fridgeId: string;
  name: string;
  onClose: () => void;
  onSaved: () => void;
  onAccessLost: () => void;
}) {
  const [draft, setDraft] = useState(name),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    pending = useRef(false),
    active = useRef(false),
    request = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError('');
    try {
      const value = parseFridgeName(draft);
      pending.current = true;
      setSaving(true);
      const controller = new AbortController();
      request.current = controller;
      const response = await fetch('/api/fridges/' + fridgeId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: value }),
          signal: controller.signal,
        }),
        json = await response.json();
      if (!active.current) return;
      if (!response.ok) {
        if ([401, 403].includes(response.status)) onAccessLost();
        throw new Error(json.error?.message ?? '냉장고 이름을 저장하지 못했어요.');
      }
      onSaved();
    } catch (caught) {
      if (active.current)
        setError(caught instanceof Error ? caught.message : '연결을 확인하고 다시 저장해 주세요.');
    } finally {
      pending.current = false;
      if (active.current) setSaving(false);
    }
  }
  return (
    <Dialog
      open
      title="냉장고 이름 변경"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      closeDisabled={saving}
    >
      <form onSubmit={save}>
        <label className="field">
          냉장고 이름
          <input
            name="name"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={80}
            required
            disabled={saving}
          />
        </label>
        {error && (
          <p role="alert" className="form-message error">
            {error}
          </p>
        )}
        <div className="rename-fridge-actions">
          <Button type="submit" disabled={saving}>
            {saving ? '저장 중…' : '이름 저장'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
