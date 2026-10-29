import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {once} from 'node:events';
import {afterAll,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../src/lib/supabase/database.types';
import {seedTestGroup,cleanupTestGroup,localAdmin,type GroupFixture} from '../support/db';
import {createInvite,clearInviteHistory} from '../../src/features/sharing/service';
import {DELETE} from '../../src/app/api/fridges/[fridgeId]/invites/history/route';
let group:GroupFixture,client:SupabaseClient<Database>;
vi.mock('@/lib/supabase/server',()=>({createServerSupabaseClient:async()=>client}));
beforeAll(async()=>{group=await seedTestGroup()});afterAll(async()=>{if(group)await cleanupTestGroup(group)});
beforeEach(async()=>{client=group.owner.client;await localAdmin().from('fridge_invites').delete().eq('fridge_id',group.fridgeId);await localAdmin().from('fridge_members').delete().eq('fridge_id',group.fridgeId).eq('user_id',group.outsider.userId)});
const access=()=>({userId:group.owner.userId,fridgeId:group.fridgeId,role:'owner' as const});
const make=()=>createInvite(access());
it('new_links_last_24_hours_and_existing_expiry_is_unchanged',async()=>{
 const old=await make(),existing='2026-12-31T23:59:00+00:00';await localAdmin().from('fridge_invites').update({expires_at:existing}).eq('id',old.inviteId);
 const fresh=await make(),row=await localAdmin().from('fridge_invites').select('created_at,expires_at').eq('id',fresh.inviteId).single();expect(Date.parse(row.data!.expires_at)-Date.parse(row.data!.created_at)).toBe(86400000);expect((await localAdmin().from('fridge_invites').select('expires_at').eq('id',old.inviteId).single()).data?.expires_at).toBe(existing);
});
it('owner_clears_only_inactive_history_in_this_fridge_and_preserves_members',async()=>{
 const active=await make(),expired=await make(),revoked=await make(),used=await make();
 await localAdmin().from('fridge_invites').update({expires_at:'2020-01-01T00:00:00Z'}).eq('id',expired.inviteId);await localAdmin().from('fridge_invites').update({revoked_at:new Date().toISOString()}).eq('id',revoked.inviteId);await localAdmin().from('fridge_invites').update({used_at:new Date().toISOString()}).eq('id',used.inviteId);
 const otherFridge=(await group.outsider.client.from('fridges').select('id').single()).data!.id;const other=await group.outsider.client.rpc('create_fridge_invite',{target_fridge_id:otherFridge,token_digest:'f'.repeat(64)}).single();await localAdmin().from('fridge_invites').update({revoked_at:new Date().toISOString()}).eq('id',other.data!.invite_id);
 const before=(await localAdmin().from('fridge_members').select('user_id').eq('fridge_id',group.fridgeId)).data;
 expect(await clearInviteHistory(access())).toBe(3);expect((await localAdmin().from('fridge_invites').select('id').eq('fridge_id',group.fridgeId)).data).toEqual([{id:active.inviteId}]);expect((await localAdmin().from('fridge_invites').select('id').eq('id',other.data!.invite_id).single()).data?.id).toBe(other.data!.invite_id);expect((await localAdmin().from('fridge_members').select('user_id').eq('fridge_id',group.fridgeId)).data).toEqual(before);expect(await clearInviteHistory(access())).toBe(0);
});
it('history_http_and_direct_rpc_reject_nonowners_and_cross_origin',async()=>{
 const origin=process.env.NEXT_PUBLIC_SITE_URL!,request=(from=origin)=>new Request(origin+'/api/fridges/'+group.fridgeId+'/invites/history',{method:'DELETE',headers:{Origin:from,'Content-Type':'application/json'},body:'{}'}),context={params:Promise.resolve({fridgeId:group.fridgeId})};
 expect((await DELETE(request('https://foreign.invalid'),context)).status).toBe(403);
 for(const identity of [group.member,group.outsider]){client=identity.client;expect((await DELETE(request(),context)).status).toBe(403);expect((await client.rpc('clear_fridge_invite_history',{target_fridge_id:group.fridgeId})).error?.code).toBe('42501')}
 client=group.owner.client;const response=await DELETE(request(),context);expect(response.status).toBe(200);expect((await response.json()).data).toEqual({deletedCount:0});
});
it('accept_cannot_join_if_expired_invite_was_deleted_while_waiting_for_fridge_lock',async()=>{
 const invite=await make();await localAdmin().from('fridge_invites').update({expires_at:'2020-01-01T00:00:00Z'}).eq('id',invite.inviteId);
 const args=['exec','-i','supabase_db_hankan','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'];const transaction=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let output='';transaction.stdout.on('data',chunk=>{output+=chunk.toString()});const finished=once(transaction,'close');let committed=false;
 try{
  transaction.stdin.write(`begin;select id from public.fridges where id='${group.fridgeId}' for update;\n\\echo LOCKED\n`);await vi.waitFor(()=>expect(output).toContain('LOCKED'));
  const acceptance=group.outsider.client.rpc('accept_fridge_invite',{token_digest:createHash('sha256').update(invite.token).digest('hex')}).then(result=>result);
  await vi.waitFor(()=>{const waiting=execFileSync('docker',['exec',...args.slice(2),'-c',"select count(*) from pg_stat_activity where wait_event_type='Lock' and query like '%accept_fridge_invite%';"],{encoding:'utf8'}).trim();expect(Number(waiting)).toBeGreaterThan(0)},{timeout:5000,interval:100});
  transaction.stdin.end(`delete from public.fridge_invites where id='${invite.inviteId}';commit;\n`);committed=true;await finished;expect((await acceptance).error?.code).toBe('P0002');expect((await localAdmin().from('fridge_members').select('user_id').eq('fridge_id',group.fridgeId).eq('user_id',group.outsider.userId)).data).toEqual([]);
 }finally{if(!committed){transaction.stdin.end('rollback;\n');await finished}}
},15000);
