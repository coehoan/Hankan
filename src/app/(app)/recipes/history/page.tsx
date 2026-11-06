import { loadFridgeDirectory } from '@/features/shell/service';
import { AppShell } from '@/features/shell/app-shell';
import { localDateAt } from '@/features/notifications/schedule';
export const metadata = { title: '추천 내역' };
export default async function RecipeHistoryPage() {
  const directory = await loadFridgeDirectory();
  return (
    <AppShell
      accountName={directory.accountName}
      view="recipe-history"
      fridges={directory.fridges}
      selectedId={directory.selectedId}
      initialToday={localDateAt(new Date().toISOString(), directory.timeZone)}
      timeZone={directory.timeZone}
    />
  );
}
