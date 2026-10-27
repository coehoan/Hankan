import {beforeEach,expect,it,vi} from 'vitest';
import {signUp} from './actions';
let callback='';
vi.mock('@/lib/supabase/server',()=>({createServerSupabaseClient:async()=>({auth:{signUp:async(input:{options:{emailRedirectTo:string}})=>{callback=input.options.emailRedirectTo;return {data:{user:null,session:null},error:null}}}})}));
beforeEach(()=>{process.env.NEXT_PUBLIC_SITE_URL='http://127.0.0.1:3000';callback=''});
it('signup_confirmation_returns_to_the_validated_invitation',async()=>{
 const next='/invite/'+'a'.repeat(43);await signUp('invite@example.test','Test-password-123!',next);
 expect(new URL(callback).searchParams.get('next')).toBe(next);
});
it('signup_confirmation_does_not_redirect_to_an_external_site',async()=>{
 await signUp('invite@example.test','Test-password-123!','https://foreign.invalid');expect(new URL(callback).searchParams.get('next')).toBe('/');
});
