import {redirect} from 'next/navigation';
import {loadFridgeDirectory} from '@/features/shell/service';
import {AppShell} from '@/features/shell/app-shell';
export const metadata={title:'오늘의 요리 추천'};
export default async function RecipesPage({params}:{params:Promise<{fridgeId:string}>}){
 const {fridgeId}=await params,directory=await loadFridgeDirectory();
 if(!directory.fridges.some(fridge=>fridge.id===fridgeId))redirect('/fridges/'+directory.fridges.find(fridge=>fridge.role==='owner')!.id+'/recipes');
 const parts=new Intl.DateTimeFormat('en',{timeZone:directory.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts();
 const today=['year','month','day'].map(type=>parts.find(part=>part.type===type)!.value).join('-');
 return <AppShell accountName={directory.accountName} view="recipes" fridges={directory.fridges} selectedId={fridgeId} initialToday={today} timeZone={directory.timeZone}/>;
}
