'use client';
import { useEffect, useState } from 'react';
import { useInventory } from '@/features/inventory/use-inventory';
import { RecipeResults } from './recipe-results';
export function RecipeList({
  fridgeId,
  fridgeName,
  initialToday,
  timeZone = 'Asia/Seoul',
  onAccessLost,
  savedJobId,
  fridgeControl,
}: {
  fridgeId: string;
  fridgeName: string;
  initialToday: string;
  timeZone?: string;
  onAccessLost?: () => void;
  savedJobId?: string;
  fridgeControl?: React.ReactNode;
}) {
  const inventory = useInventory(fridgeId),
    [today, setToday] = useState(initialToday);
  useEffect(() => {
    const timer = setInterval(() => {
      const parts = new Intl.DateTimeFormat('en', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts();
      setToday(
        ['year', 'month', 'day']
          .map((type) => parts.find((part) => part.type === type)!.value)
          .join('-'),
      );
    }, 30_000);
    return () => clearInterval(timer);
  }, [timeZone]);
  useEffect(() => {
    if (inventory.revoked) onAccessLost?.();
  }, [inventory.revoked, onAccessLost]);
  return (
    <main className="recipes-page">
      <header className="recipes-page-heading recipe-workspace-heading">
        <div>
          <p className="workspace-kicker">{savedJobId ? '추천 내역' : '오늘의 한 끼'}</p>
          <h1>{savedJobId ? '저장된 요리 추천' : '요리 추천'}</h1>
          <p>
            {savedJobId
              ? `${fridgeName}에서 요청한 요리와 당시 재료를 확인해요.`
              : '지금 있는 재료로 만들 수 있는 요리와 더 살 재료를 확인해요.'}
          </p>
        </div>
        {fridgeControl}
      </header>
      <RecipeResults
        fridgeId={fridgeId}
        ingredients={inventory.items}
        today={today}
        online={inventory.online}
        loading={inventory.loading}
        revoked={inventory.revoked}
        pending={inventory.pendingId !== null}
        inventoryError={!!inventory.error}
        onReloadInventory={() => void inventory.refresh()}
        onAccessLost={onAccessLost}
        savedJobId={savedJobId}
      />
    </main>
  );
}
