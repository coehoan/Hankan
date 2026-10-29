import {loadFridgeDirectory} from '@/features/shell/service';
import {AppShell} from '@/features/shell/app-shell';
import {localDateAt} from '@/features/notifications/schedule';
export const metadata={title:'냉장고 관리'};
export default async function FridgeManagementPage(){
 const directory=await loadFridgeDirectory();
 return <AppShell view="management" accountName={directory.accountName} fridges={directory.fridges} selectedId={directory.selectedId} initialToday={localDateAt(new Date().toISOString(),directory.timeZone)} timeZone={directory.timeZone}/>;
}
