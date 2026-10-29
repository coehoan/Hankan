'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FridgeSummary } from './contracts';
import { FridgeSwitcher } from './fridge-switcher';
import { RenameFridgeDialog } from './rename-fridge-dialog';
import { MembersDialog } from '@/features/sharing/members-dialog';

export function FridgeManagement({
  fridges,
  selectedId,
  disabled,
  onSelect,
  onAccessLost,
}: {
  fridges: FridgeSummary[];
  selectedId: string;
  disabled: boolean;
  onSelect: (id: string) => void;
  onAccessLost: () => void;
}) {
  const [dialog, setDialog] = useState<'name' | 'members' | null>(null),
    router = useRouter(),
    selected = fridges.find((fridge) => fridge.id === selectedId)!;
  return (
    <main className="my-page fridge-management">
      <header className="my-page-heading">
        <h1>냉장고 관리</h1>
        <p>냉장고 이름과 함께 쓰는 사람들을 관리해요.</p>
      </header>
      <section className="my-page-card">
        <FridgeSwitcher
          fridges={fridges}
          selectedId={selectedId}
          disabled={disabled || dialog !== null}
          onSelect={onSelect}
        />
      </section>
      <section className="my-page-card">
        <h2>{selected.name}</h2>
        <div className="management-actions">
          <button className="settings-row" onClick={() => setDialog('name')} disabled={disabled}>
            <span>냉장고 이름 변경</span>
            <span aria-hidden="true">›</span>
          </button>
          <button className="settings-row" onClick={() => setDialog('members')} disabled={disabled}>
            <span>멤버 관리</span>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </section>
      {dialog === 'name' && (
        <RenameFridgeDialog
          fridgeId={selectedId}
          name={selected.name}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            router.refresh();
          }}
          onAccessLost={onAccessLost}
        />
      )}
      {dialog === 'members' && (
        <MembersDialog
          fridgeId={selectedId}
          role={selected.role}
          onClose={() => setDialog(null)}
          onLeft={onAccessLost}
        />
      )}
    </main>
  );
}
