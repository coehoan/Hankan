'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RecipeList } from '@/features/recipes/recipe-list';
import { RecipeHistory } from '@/features/recipes/recipe-history';
import { Brand } from '@/features/auth/auth-frame';
import { MyPage } from './my-page';
import { InventoryScreen } from '@/features/inventory/inventory-screen';
import { FridgeSwitcher } from './fridge-switcher';
import type { FridgeSummary } from './contracts';
import { UploadForm } from '@/features/receipts/upload-form';
import { ProfileMenu } from './profile-menu';
import { FridgeManagement } from './fridge-management';
import { PantryIcon } from '@/components/ui/pantry-icon';

type View = 'inventory' | 'recipes' | 'recipe-history' | 'mypage' | 'management';
export function AppShell({
  fridges,
  selectedId,
  initialToday,
  timeZone,
  view = 'inventory',
  accountName = '사용자',
  savedJobId,
}: {
  view?: View;
  fridges: FridgeSummary[];
  selectedId: string;
  initialToday: string;
  timeZone: string;
  accountName?: string;
  savedJobId?: string;
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
      <a className="skip-link" href="#hankan-main">
        본문으로 건너뛰기
      </a>
      <header className="pantry-header">
        <div className="pantry-header-inner">
          <Link className="brand-link" href={'/fridges/' + selectedId}>
            <Brand />
          </Link>
          <nav aria-label="주 메뉴">
            <Link
              href={'/fridges/' + selectedId}
              aria-current={view === 'inventory' ? 'page' : undefined}
            >
              <PantryIcon name="fridge" /> 식재료
            </Link>
            <Link
              href={'/fridges/' + selectedId + '/recipes'}
              aria-current={view === 'recipes' && !savedJobId ? 'page' : undefined}
            >
              <PantryIcon name="bowl" /> 요리 추천
            </Link>
            <Link
              href="/recipes/history"
              aria-current={view === 'recipe-history' || savedJobId ? 'page' : undefined}
            >
              <PantryIcon name="history" /> 추천 내역
            </Link>
          </nav>
          <div className="pantry-account">
            <Link
              className="pantry-manage-link"
              href={'/fridges/manage?fridgeId=' + encodeURIComponent(selectedId)}
              aria-current={view === 'management' ? 'page' : undefined}
            >
              냉장고 관리
            </Link>
            <ProfileMenu
              key={accountName + ':' + selectedId}
              accountName={accountName}
              fridgeId={selectedId}
            />
          </div>
        </div>
      </header>
      <div id="hankan-main" className="pantry-body" tabIndex={-1}>
        {view !== 'management' && switching && (
          <p className="shell-status" role="status">
            냉장고를 열고 있어요…
          </p>
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
        {view === 'recipe-history' ? (
          <RecipeHistory timeZone={timeZone} onAccessLost={accessLost} fridgeId={selectedId} />
        ) : view === 'management' ? (
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
            savedJobId={savedJobId}
            fridgeControl={
              <FridgeSwitcher
                fridges={fridges}
                selectedId={selectedId}
                onSelect={(id) => void select(id)}
                disabled={switching || !online}
              />
            }
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
            fridgeControl={
              <FridgeSwitcher
                compact
                fridges={fridges}
                selectedId={selectedId}
                onSelect={(id) => void select(id)}
                disabled={switching || !online}
              />
            }
          />
        )}
      </div>
      <footer className="pantry-footer">
        한칸<span>냉장고에 있는 것부터, 오늘 한 끼.</span>
      </footer>
    </div>
  );
}
