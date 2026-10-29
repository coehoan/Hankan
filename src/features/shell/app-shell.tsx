'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RecipeList } from '@/features/recipes/recipe-list';
import { Brand } from '@/features/auth/auth-frame';
import { MyPage } from './my-page';
import { InventoryScreen } from '@/features/inventory/inventory-screen';
import { FridgeSwitcher } from './fridge-switcher';
import type { FridgeSummary } from './contracts';
import { UploadForm } from '@/features/receipts/upload-form';
import { ProfileMenu } from './profile-menu';
import { FridgeManagement } from './fridge-management';

type View = 'inventory' | 'recipes' | 'mypage' | 'management';
export function AppShell({
  fridges,
  selectedId,
  initialToday,
  timeZone,
  view = 'inventory',
  accountName = '사용자',
}: {
  view?: View;
  fridges: FridgeSummary[];
  selectedId: string;
  initialToday: string;
  timeZone: string;
  accountName?: string;
}) {
  const router = useRouter(),
    [switching, setSwitching] = useState(false),
    [error, setError] = useState(''),
    [online, setOnline] = useState(true);
  const switchingRef = useRef(false),
    selected = fridges.find((fridge) => fridge.id === selectedId)!;
  const [receiptFor, setReceiptFor] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine !== false);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  const accessLost = useCallback(() => {
    router.replace('/');
    router.refresh();
  }, [router]);
  async function select(id: string) {
    if (
      id === selectedId ||
      switchingRef.current ||
      !online ||
      !fridges.some((fridge) => fridge.id === id)
    )
      return;
    switchingRef.current = true;
    setSwitching(true);
    setError('');
    try {
      const response = await fetch('/api/fridges', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fridgeId: id }),
      });
      const json = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) accessLost();
        throw new Error(json.error?.message ?? '냉장고를 열지 못했어요.');
      }
      if (view === 'management') router.push('/fridges/manage?fridgeId=' + encodeURIComponent(id));
      else router.push('/fridges/' + id + (view === 'recipes' ? '/recipes' : ''));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '연결을 확인해 주세요.');
    } finally {
      switchingRef.current = false;
      setSwitching(false);
    }
  }
  return (
    <div className="pantry-app">
      <header className="pantry-header">
        <div>
          <Link className="brand-link" href={'/fridges/' + selectedId}>
            <Brand />
          </Link>
          <ProfileMenu
            key={accountName + ':' + selectedId}
            accountName={accountName}
            fridgeId={selectedId}
          />
        </div>
      </header>
      {(view === 'inventory' || view === 'recipes') && (
        <div className="pantry-context">
          <FridgeSwitcher
            fridges={fridges}
            selectedId={selectedId}
            onSelect={(id) => void select(id)}
            disabled={switching || !online}
          />
          {switching && <p role="status">냉장고를 열고 있어요…</p>}
        </div>
      )}
      {error && (
        <p className="shell-error" role="alert">
          {error}
        </p>
      )}
      {view === 'inventory' && receiptFor === selectedId && (
        <UploadForm
          key={'receipt:' + selectedId}
          fridgeId={selectedId}
          fridgeName={selected.name}
          onClose={() => setReceiptFor(null)}
          onCreated={(id) => router.push('/receipts/' + id)}
        />
      )}
      {view === 'management' ? (
        <FridgeManagement
          key={'management:' + selectedId}
          fridges={fridges}
          selectedId={selectedId}
          disabled={!online || switching}
          onSelect={(id) => void select(id)}
          onAccessLost={accessLost}
        />
      ) : view === 'mypage' ? (
        <MyPage onAccessLost={accessLost} />
      ) : view === 'recipes' ? (
        <RecipeList
          key={'recipes:' + selectedId}
          fridgeId={selectedId}
          fridgeName={selected.name}
          initialToday={initialToday}
          timeZone={timeZone}
          onAccessLost={accessLost}
        />
      ) : (
        <InventoryScreen
          key={'inventory:' + selectedId}
          fridgeId={selectedId}
          fridgeName={selected.name}
          initialToday={initialToday}
          timeZone={timeZone}
          onAccessLost={accessLost}
          onReceiptUpload={() => setReceiptFor(selectedId)}
        />
      )}
      <footer className="pantry-footer">
        한칸<span>냉장고를 가볍게, 한 끼를 맛있게.</span>
      </footer>
    </div>
  );
}
