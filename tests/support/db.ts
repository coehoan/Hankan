import { randomUUID } from 'node:crypto';
import { createClient,type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/supabase/database.types';

export type TestIdentity={userId:string;client:SupabaseClient<Database>};
export type GroupFixture={owner:TestIdentity;member:TestIdentity;outsider:TestIdentity;fridgeId:string};

export function readLocalTestConfig(env:Record<string,string|undefined>){
 const url=env.NEXT_PUBLIC_SUPABASE_URL;
 if(!url)throw new Error('LOCAL_TEST_CONFIG: local URL is required');
 let parsed:URL;
 try{parsed=new URL(url)}catch{throw new Error('LOCAL_TEST_ONLY: invalid URL')}
 if(!['127.0.0.1','localhost','[::1]'].includes(parsed.hostname)||!['http:','https:'].includes(parsed.protocol))throw new Error('LOCAL_TEST_ONLY: administrator is restricted to loopback');
 const key=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 const adminKey=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key||!adminKey)throw new Error('LOCAL_TEST_CONFIG: local credentials are required');
 return {url,key,adminKey};
}

const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};

export function localAdmin(){
 const {url,adminKey}=readLocalTestConfig(process.env);
 return createClient<Database>(url,adminKey,options);
}

export async function seedTestGroup():Promise<GroupFixture>{
 const {url,key}=readLocalTestConfig(process.env);
 const admin=localAdmin();
 const identities:TestIdentity[]=[];
 try{
  for(const label of ['owner','member','outsider']){
   const email=`${label}-${randomUUID()}@hankan.test`;
   const password=`Local-test-${randomUUID()}`;
   const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
   if(error||!data.user)throw new Error('Could not create local test user: '+error?.message);
   const client=createClient<Database>(url,key,options);
   identities.push({userId:data.user.id,client});
   const login=await client.auth.signInWithPassword({email,password});
   if(login.error)throw new Error('Could not sign in local test user: '+login.error.message);
  }
  const [owner,member,outsider]=identities;
  const {data:fridge,error}=await admin.from('fridges').select('id').eq('owner_user_id',owner.userId).single();
  if(error||!fridge)throw new Error('Owned fridge was not created');
  const membership=await admin.from('fridge_members').insert({fridge_id:fridge.id,user_id:member.userId,role:'member'});
  if(membership.error)throw new Error('Could not seed test membership');
  return {owner,member,outsider,fridgeId:fridge.id};
 }catch(error){
  for(const identity of identities)await admin.auth.admin.deleteUser(identity.userId);
  throw error;
 }
}

export async function cleanupTestGroup(fixture:GroupFixture):Promise<void>{
 const admin=localAdmin();
 for(const identity of [fixture.owner,fixture.member,fixture.outsider]){
  const {error}=await admin.auth.admin.deleteUser(identity.userId);
  if(error)throw new Error('Could not clean local test identity');
 }
}
