import {it,expect,vi,afterEach} from 'vitest';
import {serverSupabaseConfig,browserSupabaseUrl} from './server-config';
afterEach(()=>vi.unstubAllEnvs());
it('internal_server_url_preserves_the_public_auth_cookie_name',()=>{vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','http://127.0.0.1:54321');vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','public');vi.stubEnv('SUPABASE_SERVER_URL','http://host.docker.internal:54321');expect(serverSupabaseConfig()).toEqual({url:'http://host.docker.internal:54321',key:'public',cookieName:'sb-127-auth-token'})});
it('signed_storage_url_is_returned_with_the_browser_reachable_origin',()=>{vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','http://127.0.0.1:54321');vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','public');vi.stubEnv('SUPABASE_SERVER_URL','http://host.docker.internal:54321');expect(browserSupabaseUrl('http://host.docker.internal:54321/storage/v1/object/sign/x?token=fixture')).toBe('http://127.0.0.1:54321/storage/v1/object/sign/x?token=fixture')});
