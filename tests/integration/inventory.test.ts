import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,beforeEach,describe,expect,it } from 'vitest';
import { cleanupTestGroup,localAdmin,seedTestGroup,type GroupFixture } from '../support/db';

describe('real local versioned inventory',()=>{
 let group:GroupFixture;
 const freshInput=(overrides:Record<string,unknown>={})=>({requestId:randomUUID(),name:'  대파  ',storage:'fridge',expiresOn:'2028-02-29',...overrides});
 beforeAll(async()=>{group=await seedTestGroup()});
 afterAll(async()=>{if(group)await cleanupTestGroup(group)});
 beforeEach(async()=>{
  const result=await localAdmin().from('ingredients').delete().eq('fridge_id',group.fridgeId);
  // Before the migration this deliberately fails for the missing inventory table.
  expect(result.error).toBeNull();
 });
 async function create(overrides:Record<string,unknown>={}){
  const result=await group.owner.client.rpc('create_ingredient',{target_fridge_id:group.fridgeId,input:freshInput(overrides)});
  expect(result.error).toBeNull();expect(result.data).toBeTruthy();return result.data!;
 }
 it('owner_creates_a_trimmed_full_batch_with_audit_and_member_can_edit',async()=>{
  const item=await create();
  expect(item).toMatchObject({name:'대파',normalized_name:'대파',remaining_percent:100,version:1,created_by:group.owner.userId,updated_by:group.owner.userId});
  const edited=await group.member.client.rpc('update_ingredient',{target_fridge_id:group.fridgeId,ingredient_id:item.id,expected_version:1,patch:{remainingPercent:35,storage:'freezer'}});
  expect(edited.error).toBeNull();
  expect(edited.data).toMatchObject({remaining_percent:35,storage:'freezer',version:2,created_by:group.owner.userId,updated_by:group.member.userId});
 });
 it('simultaneous_same_request_creates_exactly_one_batch',async()=>{
  const input=freshInput();
  const results=await Promise.all([0,1].map(()=>group.owner.client.rpc('create_ingredient',{target_fridge_id:group.fridgeId,input})));
  expect(results.map(result=>result.error)).toEqual([null,null]);
  expect(results[0].data!.id).toBe(results[1].data!.id);
  const rows=await group.owner.client.from('ingredients').select('id').eq('fridge_id',group.fridgeId);
  expect(rows.data).toHaveLength(1);
 });
 it('reusing_a_request_with_different_input_is_a_conflict',async()=>{
  const input=freshInput();
  expect((await group.owner.client.rpc('create_ingredient',{target_fridge_id:group.fridgeId,input})).error).toBeNull();
  const reused=await group.owner.client.rpc('create_ingredient',{target_fridge_id:group.fridgeId,input:{...input,name:'당근'}});
  expect(reused.error?.code).toBe('PT409');
 });
 it('separate_same_name_batches_keep_distinct_dates_and_amounts',async()=>{
  const a=await create({expiresOn:'2026-11-01'});const b=await create({expiresOn:'2026-11-05'});
  expect(a.id).not.toBe(b.id);
  expect((await group.owner.client.rpc('update_ingredient',{target_fridge_id:group.fridgeId,ingredient_id:a.id,expected_version:1,patch:{remainingPercent:0}})).error).toBeNull();
  const rows=await group.member.client.from('ingredients').select('id,remaining_percent,expires_on').eq('fridge_id',group.fridgeId).order('expires_on');
  expect(rows.data).toEqual([{id:a.id,remaining_percent:0,expires_on:'2026-11-01'},{id:b.id,remaining_percent:100,expires_on:'2026-11-05'}]);
 });
 it('simultaneous_version_one_updates_have_exactly_one_winner',async()=>{
  const item=await create();
  const results=await Promise.all([group.owner,group.member].map((actor,index)=>actor.client.rpc('update_ingredient',{target_fridge_id:group.fridgeId,ingredient_id:item.id,expected_version:1,patch:{remainingPercent:index?40:65}})));
  expect(results.filter(result=>!result.error)).toHaveLength(1);
  expect(results.filter(result=>result.error?.code==='PT409')).toHaveLength(1);
  const saved=await group.owner.client.from('ingredients').select('remaining_percent,version').eq('id',item.id).single();
  expect(saved.data).toEqual({remaining_percent:results.find(result=>!result.error)!.data!.remaining_percent,version:2});
 });
 it('delete_with_stale_version_does_not_remove_newer_content',async()=>{
  const item=await create();
  await group.member.client.rpc('update_ingredient',{target_fridge_id:group.fridgeId,ingredient_id:item.id,expected_version:1,patch:{name:'손질한 대파'}});
  const removed=await group.owner.client.rpc('delete_ingredient',{target_fridge_id:group.fridgeId,ingredient_id:item.id,expected_version:1});
  expect(removed.error?.code).toBe('PT409');
  expect((await group.owner.client.from('ingredients').select('name').eq('id',item.id).single()).data?.name).toBe('손질한 대파');
 });
 it('simultaneous_update_and_delete_have_one_winner_without_resurrection',async()=>{
  const item=await create();
  const [updated,deleted]=await Promise.all([
   group.owner.client.rpc('update_ingredient',{target_fridge_id:group.fridgeId,ingredient_id:item.id,expected_version:1,patch:{remainingPercent:20}}),
   group.member.client.rpc('delete_ingredient',{target_fridge_id:group.fridgeId,ingredient_id:item.id,expected_version:1}),
  ]);
  const saved=await group.owner.client.from('ingredients').select('remaining_percent,version').eq('id',item.id);
  expect(saved.error).toBeNull();
  if(updated.error===null){expect(deleted.error?.code).toBe('PT409');expect(saved.data).toEqual([{remaining_percent:20,version:2}])}
  else{expect(updated.error.code).toBe('P0002');expect(deleted.error).toBeNull();expect(saved.data).toEqual([])}
 });
 it('deleted_batch_is_not_resurrected_by_late_update_or_create_retry',async()=>{
  const input=freshInput();
  const first=await group.owner.client.rpc('create_ingredient',{target_fridge_id:group.fridgeId,input});expect(first.error).toBeNull();
  const removed=await group.member.client.rpc('delete_ingredient',{target_fridge_id:group.fridgeId,ingredient_id:first.data!.id,expected_version:1});expect(removed.error).toBeNull();
  const late=await group.owner.client.rpc('update_ingredient',{target_fridge_id:group.fridgeId,ingredient_id:first.data!.id,expected_version:1,patch:{remainingPercent:50}});
  expect(late.error?.code).toBe('P0002');
  const retry=await group.owner.client.rpc('create_ingredient',{target_fridge_id:group.fridgeId,input});expect(retry.error?.code).toBe('P0002');
  expect((await group.owner.client.from('ingredients').select('id').eq('fridge_id',group.fridgeId)).data).toEqual([]);
 });
 it('outsider_cannot_read_create_update_or_delete',async()=>{
  const item=await create();const client=group.outsider.client;
  expect((await client.from('ingredients').select('id').eq('fridge_id',group.fridgeId)).data).toEqual([]);
  for(const result of [
   await client.rpc('create_ingredient',{target_fridge_id:group.fridgeId,input:freshInput()}),
   await client.rpc('update_ingredient',{target_fridge_id:group.fridgeId,ingredient_id:item.id,expected_version:1,patch:{name:'침입'}}),
   await client.rpc('delete_ingredient',{target_fridge_id:group.fridgeId,ingredient_id:item.id,expected_version:1}),
  ])expect(result.error?.code).toBe('42501');
 });
 it('current_fridge_cannot_modify_a_batch_from_another_fridge',async()=>{
  const item=await create();
  const own=await group.member.client.from('fridges').select('id').eq('owner_user_id',group.member.userId).single();expect(own.error).toBeNull();
  expect((await group.member.client.rpc('update_ingredient',{target_fridge_id:own.data!.id,ingredient_id:item.id,expected_version:1,patch:{remainingPercent:5}})).error?.code).toBe('P0002');
  expect((await group.member.client.rpc('delete_ingredient',{target_fridge_id:own.data!.id,ingredient_id:item.id,expected_version:1})).error?.code).toBe('P0002');
  expect((await group.owner.client.from('ingredients').select('remaining_percent').eq('id',item.id).single()).data?.remaining_percent).toBe(100);
 });
 it('direct_writes_cannot_bypass_membership_version_or_field_checks',async()=>{
  const item=await create();
  const forged=await group.member.client.from('ingredients').update({remaining_percent:50,version:99}).eq('id',item.id);expect(forged.error?.code).toBe('42501');
  expect((await group.member.client.from('ingredients').delete().eq('id',item.id)).error?.code).toBe('42501');
  expect((await group.owner.client.from('ingredient_create_requests').select('*')).error?.code).toBe('42501');
 });
 it('RPC_rejects_bad_dates_blank_names_amounts_and_protected_fields',async()=>{
  for(const invalid of [{expiresOn:'2026-02-30'},{name:'\u00a0\u3000'},{createdBy:group.outsider.userId}]){
   expect((await group.owner.client.rpc('create_ingredient',{target_fridge_id:group.fridgeId,input:freshInput(invalid)})).error?.code).toBe('22023');
  }
  const item=await create();
  for(const patch of [{remainingPercent:33},{remainingPercent:105},{remainingPercent:'50'},{name:''},{expiresOn:'2026-02-29'},{createdBy:group.outsider.userId},{}]){
   expect((await group.owner.client.rpc('update_ingredient',{target_fridge_id:group.fridgeId,ingredient_id:item.id,expected_version:1,patch})).error?.code).toBe('22023');
  }
 });
 it('revoked_member_cannot_write_or_read_even_with_an_old_request',async()=>{
  const input=freshInput();
  const created=await group.member.client.rpc('create_ingredient',{target_fridge_id:group.fridgeId,input});expect(created.error).toBeNull();
  const removed=await localAdmin().from('fridge_members').delete().eq('fridge_id',group.fridgeId).eq('user_id',group.member.userId);expect(removed.error).toBeNull();
  try{
   expect((await group.member.client.rpc('create_ingredient',{target_fridge_id:group.fridgeId,input})).error?.code).toBe('42501');
   expect((await group.member.client.rpc('update_ingredient',{target_fridge_id:group.fridgeId,ingredient_id:created.data!.id,expected_version:1,patch:{name:'늦은 변경'}})).error?.code).toBe('42501');
   expect((await group.member.client.rpc('delete_ingredient',{target_fridge_id:group.fridgeId,ingredient_id:created.data!.id,expected_version:1})).error?.code).toBe('42501');
   expect((await group.member.client.from('ingredients').select('id').eq('fridge_id',group.fridgeId)).data).toEqual([]);
   expect((await group.owner.client.from('ingredients').select('id').eq('id',created.data!.id).single()).data?.id).toBe(created.data!.id);
  }finally{await localAdmin().from('fridge_members').insert({fridge_id:group.fridgeId,user_id:group.member.userId,role:'member'})}
 });
});
