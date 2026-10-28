import {randomUUID} from 'node:crypto';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import type {Database} from '../../src/lib/supabase/database.types';
import {readLocalTestConfig,localAdmin} from '../support/db';
import {signUp} from '../../src/features/auth/actions';
import {usernameToEmail} from '../../src/features/auth/identity';
import {POST} from '../../src/app/api/auth/[action]/route';
import {resetAccountPassword} from '../../src/features/auth/admin-reset';
import {createPasswordDirectory} from '../../src/features/auth/password-directory';
const config=readLocalTestConfig(process.env),options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const newClient=()=>createClient<Database>(config.url,config.key,options);
let activeClient:SupabaseClient<Database>;
vi.mock('@/lib/supabase/server',()=>({createServerSupabaseClient:()=>Promise.resolve(activeClient)}));
const accounts=[0,1].map(()=>({username:'user_'+randomUUID().replaceAll('-','').slice(0,12),id:'',password:'Initial-'+randomUUID(),client:newClient()}));
const changed='Changed-'+randomUUID(),reset='Reset-'+randomUUID();
async function call(action:string,body:unknown){return POST(new Request(process.env.NEXT_PUBLIC_SITE_URL+'/api/auth/'+action,{method:'POST',headers:{Origin:process.env.NEXT_PUBLIC_SITE_URL!,'Content-Type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({action})})}
beforeAll(async()=>{for(const account of accounts){activeClient=account.client;await signUp(account.username,account.password);const user=await activeClient.auth.getUser();expect(user.error).toBeNull();account.id=user.data.user!.id}});
afterAll(async()=>{for(const account of accounts){await account.client.auth.signOut({scope:'local'});if(!account.id){const found=await localAdmin().auth.admin.listUsers();account.id=found.data?.users.find(u=>u.email===usernameToEmail(account.username))?.id??''}if(account.id)await localAdmin().auth.admin.deleteUser(account.id)}});
it('public_signup_has_an_immediate_session_owned_fridge_and_private_profile',async()=>{
 for(const account of accounts){expect((await account.client.auth.getSession()).data.session).toBeTruthy();const own=await account.client.from('fridges').select('id').eq('owner_user_id',account.id);expect(own.error).toBeNull();expect(own.data).toHaveLength(1)}
 expect((await accounts[0].client.from('profiles').select('user_id').eq('user_id',accounts[1].id)).data).toEqual([]);
});
it('duplicate_username_is_a_conflict_and_old_email_endpoint_is_gone',async()=>{activeClient=newClient();expect((await call('sign-up',{username:accounts[0].username.toUpperCase(),password:accounts[0].password})).status).toBe(409);expect((await call('request-reset',{email:'unused@example.test'})).status).toBe(404)});
it('anonymous_and_mismatched_password_changes_are_rejected',async()=>{activeClient=newClient();expect((await call('update-password',{password:changed,confirmPassword:changed})).status).toBe(401);activeClient=accounts[0].client;expect((await call('update-password',{password:changed,confirmPassword:reset})).status).toBe(422)});
it('password_change_is_bound_to_current_user_and_checks_both_fields',async()=>{
 activeClient=accounts[0].client;expect((await call('update-password',{password:changed,confirmPassword:changed,userId:accounts[1].id})).status).toBe(200);
 const fresh=newClient();expect((await fresh.auth.signInWithPassword({email:usernameToEmail(accounts[0].username),password:accounts[0].password})).error).toBeTruthy();expect((await fresh.auth.signInWithPassword({email:usernameToEmail(accounts[0].username),password:changed})).error).toBeNull();await fresh.auth.signOut({scope:'local'});
 expect((await accounts[1].client.auth.signInWithPassword({email:usernameToEmail(accounts[1].username),password:accounts[1].password})).error).toBeNull();
});
it('administrator_reset_updates_only_the_requested_account',async()=>{
 await resetAccountPassword(accounts[0].username.toUpperCase(),reset,reset,createPasswordDirectory());
 const fresh=newClient();expect((await fresh.auth.signInWithPassword({email:usernameToEmail(accounts[0].username),password:changed})).error).toBeTruthy();expect((await fresh.auth.signInWithPassword({email:usernameToEmail(accounts[0].username),password:reset})).error).toBeNull();await fresh.auth.signOut({scope:'local'});
 expect((await accounts[1].client.auth.signInWithPassword({email:usernameToEmail(accounts[1].username),password:accounts[1].password})).error).toBeNull();expect((await call('admin-reset',{username:accounts[0].username,password:changed})).status).toBe(404);
});
