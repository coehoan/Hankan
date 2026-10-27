import { z } from 'zod';
import { AppError } from '@/lib/errors';

const email=z.string().trim().toLowerCase().email('이메일 주소를 확인해 주세요.').max(254);
const password=z.string().min(8,'비밀번호는 8자 이상 입력해 주세요.').refine(value=>new TextEncoder().encode(value).length<=72,'비밀번호가 너무 길어요. 조금 짧게 입력해 주세요.');
const next=z.string().max(2048).optional();
const schemas={
 'sign-in':z.object({action:z.literal('sign-in'),email,password,next}),
 'sign-up':z.object({action:z.literal('sign-up'),email,password,next}),
 'request-reset':z.object({action:z.literal('request-reset'),email}),
 'update-password':z.object({action:z.literal('update-password'),password}),
 'sign-out':z.object({action:z.literal('sign-out')}),
};
export type AuthAction=keyof typeof schemas;
export type AuthInput=z.infer<(typeof schemas)[AuthAction]>;

export function parseAuthInput(action:AuthAction,value:unknown):AuthInput{
 if(value===null||typeof value!=='object'||Array.isArray(value))throw new AppError('validation','입력 내용을 확인해 주세요.');
 const result=schemas[action].safeParse({...value,action});
 if(!result.success)throw new AppError('validation',result.error.issues[0]?.message??'입력 내용을 확인해 주세요.');
 return result.data;
}
