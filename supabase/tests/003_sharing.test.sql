begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select has_table('public','fridge_invites','invites exist');
select has_function('public','create_fridge_invite',array['uuid','text'],'create invite RPC exists');
select has_function('public','accept_fridge_invite',array['text'],'accept invite RPC exists');
select has_function('public','remove_fridge_member',array['uuid','uuid'],'checked removal RPC exists');
insert into auth.users(id,email,raw_user_meta_data) values
 ('77777777-7777-4777-8777-777777777777','sharing-owner@hankan.test','{}'),
 ('88888888-8888-4888-8888-888888888888','sharing-member@hankan.test','{}'),
 ('99999999-9999-4999-8999-999999999999','sharing-outsider@hankan.test','{}');
select set_config('hankan.sharing_fridge',(select id::text from public.fridges where owner_user_id='77777777-7777-4777-8777-777777777777'),true);
insert into public.fridge_members(fridge_id,user_id) values(current_setting('hankan.sharing_fridge')::uuid,'88888888-8888-4888-8888-888888888888');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}',true);
select set_config('hankan.sharing_invite',(select invite_id::text from public.create_fridge_invite(current_setting('hankan.sharing_fridge')::uuid,repeat('a',64))),true);
select throws_ok($$select token_hash from public.fridge_invites$$,'42501',null,'even owners cannot read invite hashes directly');
select throws_ok($$select public.leave_fridge(current_setting('hankan.sharing_fridge')::uuid)$$,'42501',null,'owner cannot leave');
select throws_ok($$select public.accept_fridge_invite(repeat('a',64))$$,'42501',null,'owner cannot join self');
select set_config('request.jwt.claims','{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}',true);
select throws_ok($$select public.create_fridge_invite(current_setting('hankan.sharing_fridge')::uuid,repeat('b',64))$$,'42501',null,'member cannot bypass server to create invite');
select throws_ok($$select public.revoke_fridge_invite(current_setting('hankan.sharing_fridge')::uuid,current_setting('hankan.sharing_invite')::uuid)$$,'42501',null,'member cannot bypass server to revoke');
select throws_ok($$select public.remove_fridge_member(current_setting('hankan.sharing_fridge')::uuid,'77777777-7777-4777-8777-777777777777')$$,'42501',null,'member cannot bypass server to remove owner');
select is((select count(*) from public.list_fridge_members(current_setting('hankan.sharing_fridge')::uuid)),2::bigint,'group names are visible through checked member list');
select is((select state from public.inspect_fridge_invite(repeat('a',64))),'already_member','existing member recognizes invitation');
select set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}',true);
select is((select state from public.inspect_fridge_invite(repeat('a',64))),'valid','outsider may inspect with a valid token');
select is((select count(*) from public.fridges where id=current_setting('hankan.sharing_fridge')::uuid),0::bigint,'inspection never joins');
select lives_ok($$select public.accept_fridge_invite(repeat('a',64))$$,'explicit acceptance succeeds');
select is((select count(*) from public.fridges where id=current_setting('hankan.sharing_fridge')::uuid),1::bigint,'accepted user gains only fridge membership');
select lives_ok($$select public.leave_fridge(current_setting('hankan.sharing_fridge')::uuid)$$,'member can leave');
select throws_ok($$select public.accept_fridge_invite(repeat('a',64))$$,'PT409',null,'consumed invite cannot re-add a departed member');
reset role;
set local role anon;
select throws_ok('select id from public.fridge_invites','42501',null,'anonymous cannot read invites');
reset role;
select * from finish();
rollback;
