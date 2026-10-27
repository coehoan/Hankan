import { randomUUID } from 'node:crypto';
import { createClient,type SupabaseClient } from '@supabase/supabase-js';
import { afterAll,beforeAll,beforeEach,describe,expect,it,vi } from 'vitest';
import type { Database } from '../../src/lib/supabase/database.types';
import { cleanupTestGroup,localAdmin,readLocalTestConfig,seedTestGroup,type GroupFixture } from '../support/db';
import { GET,POST } from '../../src/app/api/fridges/[fridgeId]/ingredients/route';
import { PATCH,DELETE } from '../../src/app/api/fridges/[fridgeId]/ingredients/[ingredientId]/route';
import { listIngredients } from '../../src/features/inventory/service';

// Only the cookie/client adapter is replaced. Authentication, services, route
// handlers, RLS, RPCs and optimistic concurrency all use the actual local DB.
let activeClient:SupabaseClient<Database>;
vi.mock('@/lib/supabase/server',()=>({createServerSupabaseClient:()=>Promise.resolve(activeClient)}));

describe('inventory JSON routes with real authenticated database clients',()=>{
 let group:GroupFixture;
 const origin=process.env.NEXT_PUBLIC_SITE_URL!;
 const payload=(overrides:Record<string,unknown>={})=>({requestId:randomUUID(),name:'우유',storage:'fridge',expiresOn:'2026-11-03',...overrides});
 const context=()=>({params:Promise.resolve({fridgeId:group.fridgeId})});
 const itemContext=(id:string)=>({params:Promise.resolve({fridgeId:group.fridgeId,ingredientId:id})});
 function request(method:string,body:unknown,requestOrigin=origin){return new Request(origin+'/api/fridges/fixture/ingredients',{method,headers:{Origin:requestOrigin,'Content-Type':'application/json'},body:JSON.stringify(body)})}
 beforeAll(async()=>{group=await seedTestGroup()});
 afterAll(async()=>{if(group)await cleanupTestGroup(group)});
 beforeEach(async()=>{activeClient=group.owner.client;expect((await localAdmin().from('ingredients').delete().eq('fridge_id',group.fridgeId)).error).toBeNull()});
 async function create(overrides:Record<string,unknown>={}){
  const response=await POST(request('POST',payload(overrides)),context());expect(response.status).toBe(201);
  return (await response.json()).data;
 }
 it('member_creates_and_reads_persistent_camel_case_fields_in_expiry_order',async()=>{
  activeClient=group.member.client;
  const later=await create();const sooner=await create({name:'  당근  ',expiresOn:'2026-10-29'});
  expect(sooner).toMatchObject({fridgeId:group.fridgeId,name:'당근',remainingPercent:100,version:1,createdBy:group.member.userId,updatedBy:group.member.userId});
  activeClient=group.owner.client;
  const response=await GET(new Request(origin),context());expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  const json=await response.json();expect(json.data.map((item:{id:string})=>item.id)).toEqual([sooner.id,later.id]);
 });
 it('patch_returns_new_version_and_stale_update_returns_safe_409',async()=>{
  const item=await create();activeClient=group.member.client;
  const response=await PATCH(request('PATCH',{expectedVersion:1,patch:{remainingPercent:45}}),itemContext(item.id));
  expect(response.status).toBe(200);expect((await response.json()).data).toMatchObject({remainingPercent:45,version:2,updatedBy:group.member.userId});
  const stale=await PATCH(request('PATCH',{expectedVersion:1,patch:{remainingPercent:10}}),itemContext(item.id));
  expect(stale.status).toBe(409);expect((await stale.json()).error.code).toBe('conflict');
  expect(stale.headers.get('Cache-Control')).toBe('private, no-store');
 });
 it('delete_is_versioned_and_a_late_patch_returns_404',async()=>{
  const item=await create();
  const response=await DELETE(request('DELETE',{expectedVersion:1}),itemContext(item.id));
  expect(response.status).toBe(200);expect(await response.json()).toEqual({data:null});
  expect((await PATCH(request('PATCH',{expectedVersion:1,patch:{name:'되살리기'}}),itemContext(item.id))).status).toBe(404);
 });
 it('foreign_origin_mutations_are_rejected',async()=>{
  const item=await create();
  expect((await POST(request('POST',payload(),'https://foreign.invalid'),context())).status).toBe(403);
  expect((await PATCH(request('PATCH',{expectedVersion:1,patch:{name:'침입'}},'https://foreign.invalid'),itemContext(item.id))).status).toBe(403);
  expect((await DELETE(request('DELETE',{expectedVersion:1},'https://foreign.invalid'),itemContext(item.id))).status).toBe(403);
  expect((await group.owner.client.from('ingredients').select('name').eq('id',item.id).single()).data?.name).toBe('우유');
 });
 it('invalid_body_fields_versions_and_dates_return_422',async()=>{
  const item=await create();
  for(const body of [payload({expiresOn:'2026-02-30'}),payload({userId:group.outsider.userId}),null]){
   expect((await POST(request('POST',body),context())).status).toBe(422);
  }
  for(const body of [{expectedVersion:'1',patch:{name:'대파'}},{expectedVersion:1,patch:{remainingPercent:52}},{expectedVersion:1,patch:{}},{expectedVersion:1,patch:{name:'대파'},userId:'forged'}]){
   expect((await PATCH(request('PATCH',body),itemContext(item.id))).status).toBe(422);
  }
  expect((await DELETE(request('DELETE',{}),itemContext(item.id))).status).toBe(422);
  const malformed=new Request(origin,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{'});
  expect((await POST(malformed,context())).status).toBe(422);
 });
 it('anonymous_and_outsider_requests_are_denied',async()=>{
  activeClient=group.outsider.client;
  expect((await GET(new Request(origin),context())).status).toBe(403);
  expect((await POST(request('POST',payload()),context())).status).toBe(403);
  const {url,key}=readLocalTestConfig(process.env);
  activeClient=createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  expect((await GET(new Request(origin),context())).status).toBe(401);
 });
 it('service_does_not_trust_a_forged_access_context',async()=>{
  activeClient=group.outsider.client;
  await expect(listIngredients({userId:group.owner.userId,fridgeId:group.fridgeId,role:'owner'})).rejects.toMatchObject({code:'forbidden'});
 });
 it('creation_request_reuse_with_other_payload_returns_409',async()=>{
  const input=payload();
  expect((await POST(request('POST',input),context())).status).toBe(201);
  const repeated=await POST(request('POST',{...input,name:'다른 재료'}),context());
  expect(repeated.status).toBe(409);expect((await repeated.json()).error.code).toBe('conflict');
 });
});
