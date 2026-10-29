import { loadFridgeDirectory } from '@/features/shell/service';
import { AppShell } from '@/features/shell/app-shell';
import { localDateAt } from '@/features/notifications/schedule';
export const metadata = { title: '냉장고 관리' };
export default async function FridgeManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ fridgeId?: string | string[] }>;
}) {
  const directory = await loadFridgeDirectory();
  const requested = (await searchParams).fridgeId;
  const selectedId =
    typeof requested === 'string' && directory.fridges.some((fridge) => fridge.id === requested)
      ? requested
      : directory.selectedId;
  return (
    <AppShell
      view="management"
      accountName={directory.accountName}
      fridges={directory.fridges}
      selectedId={selectedId}
      initialToday={localDateAt(new Date().toISOString(), directory.timeZone)}
      timeZone={directory.timeZone}
    />
  );
}
