import { loadFridgeDirectory } from '@/features/shell/service';
import { AppShell } from '@/features/shell/app-shell';
import { localDateAt } from '@/features/notifications/schedule';
export const metadata = { title: '마이페이지' };
export default async function MyPageRoute() {
  const directory = await loadFridgeDirectory();
  return (
    <AppShell
      accountName={directory.accountName}
      view="mypage"
      fridges={directory.fridges}
      selectedId={directory.selectedId}
      initialToday={localDateAt(new Date().toISOString(), directory.timeZone)}
      timeZone={directory.timeZone}
    />
  );
}
