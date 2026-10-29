import {afterEach,expect,it,vi} from 'vitest';
import {POST} from '@/app/api/internal/worker/route';
const state=vi.hoisted(()=>({stagingReads:0}));
vi.mock('@/features/notifications/web-push-transport',()=>({createWebPushTransport:()=>null}));
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabaseClient:()=>({
 rpc:async()=>({error:null}),
 from:()=>({select:()=>({eq:()=>({limit:async()=>({data:[{id:'draft',object_path:'private-path'}],error:null})})})}),
 storage:{from:()=>({remove:async()=>({error:new Error('private storage outage')}),list:async()=>{state.stagingReads++;return {data:[],error:null}}})},
})}));
afterEach(()=>vi.unstubAllEnvs());
it('resolved_storage_error_propagates_through_real_worker_as_retryable_http_failure',async()=>{
 vi.stubEnv('WORKER_SECRET','secret-32-characters-or-more-for-worker');
 const response=await POST(new Request('https://example.test/api/internal/worker',{method:'POST',headers:{Authorization:'Bearer secret-32-characters-or-more-for-worker'}}));
 expect(response.status).toBe(503);expect(await response.text()).not.toContain('private storage outage');expect(state.stagingReads).toBe(1);
});
