import { z } from 'zod';
import { AppError } from '@/lib/errors';

const username=z.string().trim().toLowerCase().regex(/^[a-z0-9_]{4,24}$/,'아이디는 영문·숫자·밑줄 4~24자로 입력해 주세요.');
const password=z.string().min(8,'비밀번호는 8자 이상 입력해 주세요.').refine(value=>new TextEncoder().encode(value).length<=72,'비밀번호가 너무 길어요. 조금 짧게 입력해 주세요.');
const next=z.string().max(2048).optional();
const schemas={
 'sign-in':z.object({action:z.literal('sign-in'),username,password,next}),
 'sign-up':z.object({action:z.literal('sign-up'),username,password,next}),
 'update-password':z.object({action:z.literal('update-password'),password,confirmPassword:z.string()}).refine(value=>value.password===value.confirmPassword,{message:'새 비밀번호가 서로 달라요.',path:['confirmPassword']}),
 'sign-out':z.object({action:z.literal('sign-out')}),
};
export type AuthAction=keyof typeof schemas;
export type AuthInput=z.infer<(typeof schemas)[AuthAction]>;
export function parseUsername(value:unknown):string{const result=username.safeParse(value);if(!result.success)throw new AppError('validation',result.error.issues[0].message);return result.data}

export function parseAuthInput(action:AuthAction,value:unknown):AuthInput{
 if(value===null||typeof value!=='object'||Array.isArray(value))throw new AppError('validation','입력 내용을 확인해 주세요.');
 const result=schemas[action].safeParse({...value,action});
 if(!result.success)throw new AppError('validation',result.error.issues[0]?.message??'입력 내용을 확인해 주세요.');
 return result.data;
}
