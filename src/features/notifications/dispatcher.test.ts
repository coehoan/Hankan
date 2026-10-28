import {describe,it,expect,vi} from 'vitest';
import {buildDigest} from './digest';
import {dispatchDigest} from './dispatcher';
import type {DigestJob,DispatchState,Outbox,PushTransport} from './types';
const job:DigestJob={id:'job',userId:'user',localDate:'2026-10-28',dueAt:'2026-10-28T00:00:00Z',leaseUntil:null,leaseToken:'token',status:'leased'};
const ingredient=(expiresOn:string,remainingPercent=100)=>({id:'i',fridgeId:'f',name:'비공개 재료',normalizedName:'비공개 재료',expiresOn,remainingPercent,storage:'fridge' as const,version:1,createdBy:'user',updatedBy:'user',createdAt:'',updatedAt:''});
const state:NonNullable<DispatchState>={digest:{userId:'user',localDate:job.localDate,groups:[{fridgeId:'f',fridgeName:'냉장고',ingredients:[ingredient(job.localDate)]}]},subscriptions:[{id:'s',userId:'user',endpoint:'https://fcm.googleapis.com/test',p256dh:'key',auth:'auth'}]};
describe('digest dispatch',()=>{
 it('only_accessible_urgent_items_are_in_digest',()=>{
  const digest=buildDigest('user',job.localDate,[{fridgeId:'f',fridgeName:'냉장고',ingredients:[ingredient('2026-10-27'),ingredient('2026-10-28'),ingredient('2026-10-31'),ingredient('2026-11-01'),ingredient('2026-10-29',0)]}]);
  expect(digest?.groups[0].ingredients.map(i=>i.expiresOn)).toEqual(['2026-10-28','2026-10-31']);
  expect(buildDigest('user',job.localDate,[])).toBeNull();
 });
 it('revoked_membership_is_rechecked_before_send',async()=>{
  const outbox:Outbox={prepare:vi.fn().mockResolvedValueOnce(state).mockResolvedValue(null),record:vi.fn(),finish:vi.fn()};
  const transport:PushTransport={send:vi.fn()};await dispatchDigest(job,transport,outbox);
  expect(transport.send).not.toHaveBeenCalled();expect(outbox.finish).toHaveBeenCalledWith(job,false);
 });
 it('gone_subscription_is_deleted_and_payload_has_no_inventory_text',async()=>{
  const outbox:Outbox={prepare:vi.fn().mockResolvedValue(state),record:vi.fn(),finish:vi.fn()};
  const transport:PushTransport={send:vi.fn().mockResolvedValue('gone')};await dispatchDigest(job,transport,outbox);
  expect(outbox.record).toHaveBeenCalledWith(job,'s','gone');expect(JSON.stringify(vi.mocked(transport.send).mock.calls)).not.toContain('비공개 재료');
 });
 it('one_subscription_failure_does_not_block_another',async()=>{
  const two={...state,subscriptions:[...state.subscriptions,{...state.subscriptions[0],id:'second'}]};
  const outbox:Outbox={prepare:vi.fn().mockResolvedValue(two),record:vi.fn(),finish:vi.fn()};
  const transport:PushTransport={send:vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce('sent')};
  await dispatchDigest(job,transport,outbox);expect(outbox.record).toHaveBeenCalledWith(job,'second','sent');expect(outbox.finish).toHaveBeenCalledWith(job,true);
 });
});
