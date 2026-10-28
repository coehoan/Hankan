import 'server-only';
import {AppError} from '@/lib/errors';
import type {AiProvider} from './contracts';
import {createSelectedProvider} from './selected-provider';
export function getAiProvider():AiProvider{
 const apiKey=process.env.OPENAI_API_KEY?.trim();
 if(!apiKey)throw new AppError('provider_unconfigured','AI 분석은 아직 연결되지 않았어요. 아래에서 품목을 직접 입력해 주세요.');
 return createSelectedProvider({apiKey,model:'gpt-6-luna'});
}
