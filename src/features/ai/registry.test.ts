import {afterEach,expect,it,vi} from 'vitest';
import {getAiProvider} from './registry';
afterEach(()=>vi.unstubAllEnvs());
it('reports_unconfigured_provider_instead_of_returning_fake_analysis',()=>{vi.stubEnv('OPENAI_API_KEY','');expect(getAiProvider).toThrowError(expect.objectContaining({code:'provider_unconfigured'}))});
it('configured_key_creates_provider_without_making_a_paid_request',()=>{vi.stubEnv('OPENAI_API_KEY','unit-test-key');expect(getAiProvider()).toEqual({extractReceipt:expect.any(Function),recommendRecipes:expect.any(Function)})});
