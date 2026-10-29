import { redirect } from 'next/navigation';
import { loadFridgeDirectory } from '@/features/shell/service';
import { AppShell } from '@/features/shell/app-shell';

export default async function FridgePage({ params }: { params: Promise<{ fridgeId: string }> }) {
  const { fridgeId } = await params;
  const directory = await loadFridgeDirectory();
  if (!directory.fridges.some((fridge) => fridge.id === fridgeId))
    redirect('/fridges/' + directory.fridges.find((fridge) => fridge.role === 'owner')!.id);
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: directory.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts();
  const today = ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join('-');
  return (
    <AppShell
      accountName={directory.accountName}
      fridges={directory.fridges}
      selectedId={fridgeId}
      initialToday={today}
      timeZone={directory.timeZone}
    />
  );
}
