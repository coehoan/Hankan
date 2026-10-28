import {expect,it} from 'vitest';
import {getAiProvider} from './registry';
it('reports_unconfigured_provider_instead_of_returning_fake_analysis',()=>{expect(getAiProvider).toThrowError(expect.objectContaining({code:'provider_unconfigured'}))});
