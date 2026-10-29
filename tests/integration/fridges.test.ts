import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll,beforeAll,describe,expect,it,vi } from 'vitest';
import type { Database } from '../../src/lib/supabase/database.types';
import { cleanupTestGroup,localAdmin,seedTestGroup,type GroupFixture } from '../support/db';
import { GET,PATCH } from '../../src/app/api/fridges/route';
import { loadFridgeDirectory } from '../../src/features/shell/service';
import FridgeManagementPage from '../../src/app/(app)/fridges/manage/page';
let activeClient:SupabaseClient<Database>;
vi.mock('@/lib/supabase/server',()=>({createServerSupabaseClient:()=>Promise.resolve(activeClient)}));

describe('fridge directory and private last selection',()=>{
 let group:GroupFixture;
 const origin=process.env.NEXT_PUBLIC_SITE_URL!;
 const request=(body:unknown,from=origin)=>new Request(origin+'/api/fridges',{method:'PATCH',headers:{Origin:from,'Content-Type':'application/json'},body:JSON.stringify(body)});
 beforeAll(async()=>{group=await seedTestGroup();await localAdmin().from('fridges').update({name:'우리집 냉장고'}).eq('id',group.fridgeId)});
 afterAll(async()=>{if(group)await cleanupTestGroup(group)});
 it('lists_owned_and_shared_fridges_without_an_outsiders_fridge',async()=>{
  activeClient=group.member.client;
  const result=await GET();expect(result.status).toBe(200);expect(result.headers.get('Cache-Control')).toBe('private, no-store');
  const json=await result.json();expect(json.data).toHaveLength(2);
  expect(json.data).toEqual(expect.arrayContaining([expect.objectContaining({id:group.fridgeId,name:'우리집 냉장고',role:'member'}),expect.objectContaining({name:'내 냉장고',role:'owner'})]));
 });
 it('persists_an_accessible_selection_only_in_the_current_users_profile',async()=>{
  activeClient=group.member.client;
  expect((await PATCH(request({fridgeId:group.fridgeId}))).status).toBe(200);
  expect((await loadFridgeDirectory()).selectedId).toBe(group.fridgeId);
  expect((await localAdmin().from('profiles').select('last_fridge_id').eq('user_id',group.outsider.userId).single()).data?.last_fridge_id).not.toBe(group.fridgeId);
 });
 it('directory_includes_only_the_current_accounts_display_name',async()=>{
  await localAdmin().from('profiles').update({display_name:'fresh_member'}).eq('user_id',group.member.userId);
  await localAdmin().from('profiles').update({display_name:'other_person'}).eq('user_id',group.outsider.userId);
  activeClient=group.member.client;expect((await loadFridgeDirectory()).accountName).toBe('fresh_member');
 });
 it('management_keeps_the_opened_fridge_even_when_saved_selection_differs',async()=>{
  activeClient=group.member.client;const own=(await loadFridgeDirectory()).fridges.find(fridge=>fridge.role==='owner')!;
  await PATCH(request({fridgeId:own.id}));
  const page=await FridgeManagementPage({searchParams:Promise.resolve({fridgeId:group.fridgeId})});expect(page.props.selectedId).toBe(group.fridgeId);
 });
 it('management_query_cannot_select_an_inaccessible_fridge',async()=>{
  activeClient=group.outsider.client;const directory=await loadFridgeDirectory();
  const page=await FridgeManagementPage({searchParams:Promise.resolve({fridgeId:group.fridgeId})});expect(page.props.selectedId).toBe(directory.selectedId);expect(page.props.fridges.some((fridge:{id:string})=>fridge.id===group.fridgeId)).toBe(false);
 });
 it('cannot_select_an_inaccessible_fridge_or_override_another_users_preference',async()=>{
  activeClient=group.outsider.client;
  expect((await PATCH(request({fridgeId:group.fridgeId}))).status).toBe(403);
  activeClient=group.member.client;
  expect((await PATCH(request({fridgeId:group.fridgeId,userId:group.outsider.userId}))).status).toBe(422);
 });
 it('rejects_cross_origin_and_malformed_selection_requests',async()=>{
  activeClient=group.member.client;
  expect((await PATCH(request({fridgeId:group.fridgeId},'https://foreign.invalid'))).status).toBe(403);
  expect((await PATCH(request({fridgeId:'../other'}))).status).toBe(422);
 });
 it('falls_back_to_own_fridge_when_the_last_shared_selection_was_revoked',async()=>{
  activeClient=group.member.client;
  await PATCH(request({fridgeId:group.fridgeId}));
  const removal=await localAdmin().from('fridge_members').delete().eq('fridge_id',group.fridgeId).eq('user_id',group.member.userId);expect(removal.error).toBeNull();
  try{
   const directory=await loadFridgeDirectory();expect(directory.fridges).toHaveLength(1);
   expect(directory.fridges[0].role).toBe('owner');expect(directory.selectedId).toBe(directory.fridges[0].id);expect(directory.timeZone).toBe('Asia/Seoul');
  }finally{await localAdmin().from('fridge_members').insert({fridge_id:group.fridgeId,user_id:group.member.userId,role:'member'})}
 });
});
