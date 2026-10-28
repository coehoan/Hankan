import type {SupabaseClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import type {Database} from '../../src/lib/supabase/database.types';
import {cleanupTestGroup,localAdmin,seedTestGroup,type GroupFixture} from '../support/db';
import {getNotificationPreferences,saveNotificationPreferences} from '../../src/features/notifications/settings';
import {GET,PATCH} from '../../src/app/api/settings/notifications/route';
let activeClient:SupabaseClient<Database>,group:GroupFixture;
vi.mock('@/lib/supabase/server',()=>({createServerSupabaseClient:()=>Promise.resolve(activeClient)}));
const request=(body:unknown,origin=process.env.NEXT_PUBLIC_SITE_URL!)=>new Request(process.env.NEXT_PUBLIC_SITE_URL+'/api/settings/notifications',{method:'PATCH',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
beforeAll(async()=>{group=await seedTestGroup()});
beforeEach(async()=>{activeClient=group.member.client;await localAdmin().from('notification_preferences').update({enabled:false,local_time:'09:00',last_sent_local_date:null}).eq('user_id',group.member.userId)});
afterAll(async()=>{if(group)await cleanupTestGroup(group)});
it('defaults_are_personal_disabled_nine_am_seoul',async()=>{expect(await getNotificationPreferences()).toEqual({enabled:false,localTime:'09:00',timezone:'Asia/Seoul',nextRunAt:null})});
it('member_cannot_read_or_change_another_members_preferences',async()=>{
 await saveNotificationPreferences({enabled:true,localTime:'20:30'});
 expect((await activeClient.from('notification_preferences').select('*').eq('user_id',group.owner.userId)).data).toEqual([]);
 expect((await activeClient.from('notification_preferences').update({enabled:true,local_time:'22:00'}).eq('user_id',group.owner.userId)).error).not.toBeNull();
 expect((await localAdmin().from('notification_preferences').select('enabled,local_time').eq('user_id',group.owner.userId).single()).data).toMatchObject({enabled:false,local_time:'09:00'});
 expect((await activeClient.rpc('save_notification_preferences',{input:{enabled:true,localTime:'22:00',userId:group.owner.userId}})).error?.code).toBe('22023');
});
it('on_off_time_persist_for_new_authenticated_client_and_next_run_is_server_computed',async()=>{
 const saved=await saveNotificationPreferences({enabled:true,localTime:'20:30'});expect(saved.nextRunAt).not.toBeNull();expect(Date.parse(saved.nextRunAt!)).toBeGreaterThan(Date.now());
 const user=await activeClient.auth.getUser(),email=user.data.user!.email!,password='Local-stage9-'+randomUUID();
 expect((await localAdmin().auth.admin.updateUserById(group.member.userId,{password})).error).toBeNull();
 await activeClient.auth.signOut();expect((await activeClient.auth.signInWithPassword({email,password})).error).toBeNull();
 // A new authenticated session rereads durable state rather than frontend memory.
 const response=await GET();expect(await response.json()).toMatchObject({data:{enabled:true,localTime:'20:30'}});
 const off=await saveNotificationPreferences({enabled:false,localTime:'20:30'});expect(off).toMatchObject({enabled:false,localTime:'20:30',nextRunAt:null});
 expect(await getNotificationPreferences()).toEqual(off);
});
it('same_day_already_sent_then_toggle_and_time_change_do_not_schedule_today',async()=>{
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const mark=await localAdmin().from('notification_preferences').update({last_sent_local_date:date}).eq('user_id',group.member.userId);expect(mark.error).toBeNull();
 await saveNotificationPreferences({enabled:false,localTime:'23:59'});const value=await saveNotificationPreferences({enabled:true,localTime:'23:59'});
 const nextDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value.nextRunAt!));expect(nextDate>date).toBe(true);
});
it.each(['24:00','09:60','9:00','20:30:00'])('invalid_time_%s_never_changes_saved_preferences',async localTime=>{await expect(saveNotificationPreferences({enabled:true,localTime})).rejects.toMatchObject({code:'validation'});expect(await getNotificationPreferences()).toMatchObject({enabled:false,localTime:'09:00'})});
it('direct_writes_cannot_forge_last_sent_or_utc_schedule',async()=>{expect((await activeClient.from('notification_preferences').update({last_sent_local_date:'2026-10-28',next_run_at:'2026-10-28T00:00:00Z'}).eq('user_id',group.member.userId)).error?.code).toBe('42501')});
it('fridge_owner_also_cannot_read_or_change_a_members_personal_schedule',async()=>{activeClient=group.owner.client;expect((await activeClient.from('notification_preferences').select('*').eq('user_id',group.member.userId)).data).toEqual([]);expect((await activeClient.from('notification_preferences').update({enabled:true}).eq('user_id',group.member.userId)).error?.code).toBe('42501')});
it('invalid_profile_timezone_is_rejected_atomically',async()=>{expect((await localAdmin().from('profiles').update({timezone:'Invalid/Zone'}).eq('user_id',group.member.userId)).error?.code).toBe('22023');expect((await getNotificationPreferences()).timezone).toBe('Asia/Seoul')});
it('route_is_private_checks_origin_and_rejects_forged_identity_timezone_and_schedule',async()=>{
 expect((await PATCH(request({enabled:true,localTime:'20:30'},'https://other.invalid'))).status).toBe(403);
 for(const extra of [{userId:group.owner.userId},{timezone:'Etc/UTC'},{nextRunAt:'2099-01-01T00:00:00Z'},{lastSentLocalDate:'2026-10-28'}])expect((await PATCH(request({enabled:true,localTime:'20:30',...extra}))).status).toBe(422);
 const response=await PATCH(request({enabled:true,localTime:'20:30'}));expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store');expect((await GET()).headers.get('Cache-Control')).toBe('private, no-store');
});
it('anonymous_requests_cannot_read_or_save_preferences',async()=>{const anonymous=localAdmin();activeClient=anonymous;expect((await GET()).status).toBe(401);expect((await PATCH(request({enabled:true,localTime:'20:30'}))).status).toBe(401)});
