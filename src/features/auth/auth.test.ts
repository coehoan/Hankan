import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertSameOrigin, requireFridgeAccess, requireUser } from '@/lib/auth';
import { safeNextPath } from '@/features/auth/redirects';

const USER='11111111-1111-4111-8111-111111111111';
const FRIDGE='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const external=vi.hoisted(()=>{
 const query={ select:vi.fn(), eq:vi.fn(), maybeSingle:vi.fn() };
 return { getClaims:vi.fn(), getSession:vi.fn(), from:vi.fn(), query };
});

vi.mock('@/lib/supabase/server',()=>({
 createServerSupabaseClient:async()=>({ auth:{getClaims:external.getClaims,getSession:external.getSession},from:external.from }),
}));

beforeEach(()=>{
 vi.resetAllMocks();
 vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://hankan.test');
 external.getClaims.mockResolvedValue({data:{claims:{iss:'https://supabase.test/auth/v1',sub:USER,aud:'authenticated',exp:9999999999,iat:1700000000,email:'verified@example.test',phone:'',app_metadata:{provider:'email',providers:['email']},user_metadata:{email_verified:true},role:'authenticated',aal:'aal1',amr:[{method:'password',timestamp:1700000000}],session_id:'44444444-4444-4444-8444-444444444444',is_anonymous:false},header:{alg:'ES256',typ:'JWT',kid:'fixture'},signature:new Uint8Array()},error:null});
 external.getSession.mockResolvedValue({data:{session:{user:{id:'forged-cookie-subject'},access_token:'untrusted',refresh_token:'untrusted',expires_in:3600,token_type:'bearer'}},error:null});
 external.from.mockReturnValue(external.query);
 external.query.select.mockReturnValue(external.query);
 external.query.eq.mockReturnValue(external.query);
 external.query.maybeSingle.mockResolvedValue({data:{role:'member'},error:null,status:200,statusText:'OK',count:null});
});

describe('verified identity and membership',()=>{
 it('uses_the_verified_subject_instead_of_the_cookie_subject',async()=>{
  await expect(requireUser()).resolves.toEqual({userId:USER});
 });
 it('forged_cookie_is_not_an_identity',async()=>{
  external.getClaims.mockResolvedValue({data:null,error:new Error('Invalid JWT signature')});
  await expect(requireUser()).rejects.toMatchObject({code:'unauthenticated',status:401});
 });
 it('missing_claims_cannot_fall_back_to_unverified_session',async()=>{
  external.getClaims.mockResolvedValue({data:{claims:null},error:null});
  await expect(requireUser()).rejects.toMatchObject({code:'unauthenticated'});
 });
 it('returns_the_current_member_access',async()=>{
  await expect(requireFridgeAccess(FRIDGE)).resolves.toEqual({userId:USER,fridgeId:FRIDGE,role:'member'});
 });
 it('outsider_cannot_read_fridge',async()=>{
  external.query.maybeSingle.mockResolvedValue({data:null,error:null,status:200,statusText:'OK',count:null});
  await expect(requireFridgeAccess(FRIDGE)).rejects.toMatchObject({code:'forbidden',status:403});
 });
 it('member_cannot_promote_self_by_requesting_owner_access',async()=>{
  await expect(requireFridgeAccess(FRIDGE,'owner')).rejects.toMatchObject({code:'forbidden'});
 });
 it('owner_can_use_owner_access',async()=>{
  external.query.maybeSingle.mockResolvedValue({data:{role:'owner'},error:null,status:200,statusText:'OK',count:null});
  await expect(requireFridgeAccess(FRIDGE,'owner')).resolves.toMatchObject({role:'owner',userId:USER});
 });
 it('database_errors_do_not_grant_access',async()=>{
  external.query.maybeSingle.mockResolvedValue({data:null,error:{message:'database unavailable',code:'08006'},status:503,statusText:'Unavailable',count:null});
  await expect(requireFridgeAccess(FRIDGE)).rejects.toMatchObject({code:'internal'});
 });
});

describe('mutation origin',()=>{
 it('allows_the_configured_same_origin',()=>{
  expect(()=>assertSameOrigin(new Request('https://hankan.test/api/auth/sign-in',{method:'POST',headers:{Origin:'https://hankan.test','Content-Type':'application/json'}}))).not.toThrow();
 });
 it('cross_origin_mutation_is_rejected',()=>{
  expect(()=>assertSameOrigin(new Request('https://hankan.test/api/auth/sign-in',{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'}}))).toThrowError(expect.objectContaining({code:'forbidden'}));
 });
 it('missing_origin_is_rejected',()=>{
  expect(()=>assertSameOrigin(new Request('https://hankan.test/api/auth/sign-out',{method:'POST'}))).toThrowError(expect.objectContaining({code:'forbidden'}));
 });
 it('non_json_mutations_are_rejected',()=>{
  expect(()=>assertSameOrigin(new Request('https://hankan.test/api/auth/sign-in',{method:'POST',headers:{Origin:'https://hankan.test','Content-Type':'text/plain'}}))).toThrowError(expect.objectContaining({code:'validation'}));
 });
});

describe('auth return path',()=>{
 it.each(['https://evil.test','//evil.test','/\\evil.test','javascript:alert(1)','/%2f%2fevil.test'])('rejects_external_redirect_%s',(value)=>{
  expect(safeNextPath(value)).toBe('/');
 });
 it('preserves_a_local_invite_return_path',()=>{
  expect(safeNextPath('/invite/sample-token?from=signup')).toBe('/invite/sample-token?from=signup');
 });
 it('uses_a_safe_fallback_for_missing_return_path',()=>{
  expect(safeNextPath(null)).toBe('/');
 });
});
