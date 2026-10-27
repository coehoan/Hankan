begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

select has_table('public','ingredients','ingredients exist');
select has_table('public','ingredient_create_requests','creation request tombstones exist');

insert into auth.users(id,email,raw_user_meta_data) values
 ('44444444-4444-4444-8444-444444444444','inventory-owner@hankan.test','{}'),
 ('55555555-5555-4555-8555-555555555555','inventory-member@hankan.test','{}'),
 ('66666666-6666-4666-8666-666666666666','inventory-outsider@hankan.test','{}');
select set_config('hankan.test_fridge',(select id::text from public.fridges where owner_user_id='44444444-4444-4444-8444-444444444444'),true);
insert into public.fridge_members(fridge_id,user_id) values(current_setting('hankan.test_fridge')::uuid,'55555555-5555-4555-8555-555555555555');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',true);
create temporary table test_inventory_item as select * from public.create_ingredient(current_setting('hankan.test_fridge')::uuid,'{"requestId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","name":"  Spring   Onion  ","storage":"fridge","expiresOn":"2028-02-29"}'::jsonb);
select is((select name from test_inventory_item),'Spring   Onion','display name is trimmed');
select is((select normalized_name from test_inventory_item),'spring onion','matching name collapses whitespace and case');
select is((select remaining_percent from test_inventory_item),100,'new batch is full');
select is((select version from test_inventory_item),1,'new batch has version one');
select is((select created_by::text from test_inventory_item),'44444444-4444-4444-8444-444444444444','audit identity comes from authentication');
select throws_ok($$update public.ingredients set remaining_percent=50$$,'42501',null,'direct updates cannot bypass version checks');
select throws_ok($$delete from public.ingredients$$,'42501',null,'direct deletes cannot bypass version checks');
select throws_ok($$insert into public.ingredients(fridge_id,name,storage,expires_on,created_by,updated_by) select fridge_id,name,storage,expires_on,created_by,updated_by from test_inventory_item$$,'42501',null,'direct inserts are forbidden');
select throws_ok($$select * from public.ingredient_create_requests$$,'42501',null,'idempotency records are private');
select throws_ok($$select public.update_ingredient(current_setting('hankan.test_fridge')::uuid,(select id from test_inventory_item),1,'{"remainingPercent":33}')$$,'22023',null,'non-five-percent amounts rejected');
select throws_ok($$select public.update_ingredient(current_setting('hankan.test_fridge')::uuid,(select id from test_inventory_item),1,'{"expiresOn":"2026-02-30"}')$$,'22023',null,'invalid calendar date rejected');
select throws_ok($$select public.update_ingredient(current_setting('hankan.test_fridge')::uuid,(select id from test_inventory_item),1,'{"version":100}')$$,'22023',null,'protected patch fields rejected');

reset role;
grant select on test_inventory_item to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}',true);
select lives_ok($$select public.update_ingredient(current_setting('hankan.test_fridge')::uuid,(select id from test_inventory_item),1,'{"remainingPercent":0}')$$,'member can edit remaining amount');
select is((select count(*) from public.ingredients where remaining_percent=0),1::bigint,'zero amount is retained');
select is((select version from public.ingredients where id=(select id from test_inventory_item)),2,'update increments version');
select is((select updated_by::text from public.ingredients where id=(select id from test_inventory_item)),'55555555-5555-4555-8555-555555555555','member audit identity is recorded');
select throws_ok($$select public.delete_ingredient(current_setting('hankan.test_fridge')::uuid,(select id from test_inventory_item),1)$$,'PT409',null,'stale delete conflicts');

select set_config('request.jwt.claims','{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}',true);
select is((select count(*) from public.ingredients),0::bigint,'outsider cannot read inventory');
select throws_ok($$select public.update_ingredient(current_setting('hankan.test_fridge')::uuid,(select id from test_inventory_item),2,'{"name":"hijack"}')$$,'42501',null,'outsider cannot edit');
select throws_ok($$select public.delete_ingredient(current_setting('hankan.test_fridge')::uuid,(select id from test_inventory_item),2)$$,'42501',null,'outsider cannot delete');

reset role;
delete from public.fridge_members where fridge_id=current_setting('hankan.test_fridge')::uuid and user_id='55555555-5555-4555-8555-555555555555';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}',true);
select is((select count(*) from public.ingredients),0::bigint,'revoked member cannot read');
select throws_ok($$select public.update_ingredient(current_setting('hankan.test_fridge')::uuid,(select id from test_inventory_item),2,'{"name":"late"}')$$,'42501',null,'revoked member cannot write');

select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',true);
select lives_ok($$select public.delete_ingredient(current_setting('hankan.test_fridge')::uuid,(select id from test_inventory_item),2)$$,'owner can delete current version');
select throws_ok($$select public.update_ingredient(current_setting('hankan.test_fridge')::uuid,(select id from test_inventory_item),2,'{"remainingPercent":50}')$$,'P0002',null,'late update cannot recreate deleted batch');
select throws_ok($$select public.create_ingredient(current_setting('hankan.test_fridge')::uuid,'{"requestId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","name":"Spring   Onion","storage":"fridge","expiresOn":"2028-02-29"}')$$,'P0002',null,'create retry cannot recreate deleted batch');
select is((select count(*) from public.ingredients),0::bigint,'batch remains deleted');

reset role;
set local role anon;
select throws_ok($$select * from public.ingredients$$,'42501',null,'anonymous inventory reads are forbidden');
select throws_ok($$select public.create_ingredient(current_setting('hankan.test_fridge')::uuid,'{}')$$,'42501',null,'anonymous RPC execution is forbidden');
reset role;
select * from finish();
rollback;
