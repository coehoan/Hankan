import 'server-only';
import {AppError} from '@/lib/errors';
import type {AiProvider} from './contracts';
export function getAiProvider():AiProvider{throw new AppError('provider_unconfigured','AI 분석은 아직 연결되지 않았어요. 아래에서 품목을 직접 입력해 주세요.')}
