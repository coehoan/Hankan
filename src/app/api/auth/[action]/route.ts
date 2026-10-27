import { assertSameOrigin } from '@/lib/auth';
import { AppError,errorResponse } from '@/lib/errors';
import { parseAuthInput,type AuthAction } from '@/features/auth/validation';
import { safeNextPath } from '@/features/auth/redirects';
import { signIn,signUp,requestPasswordReset,updatePassword,signOut } from '@/features/auth/actions';

export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){
 try{
  assertSameOrigin(request);
  const {action}=await params;
  if(!['sign-in','sign-up','request-reset','update-password','sign-out'].includes(action))throw new AppError('not_found','요청한 기능을 찾을 수 없어요.');
  const raw=await request.text();
  if(new TextEncoder().encode(raw).length>8192)throw new AppError('validation','입력 내용이 너무 길어요.');
  let body:unknown;
  try{body=JSON.parse(raw)}catch{throw new AppError('validation','입력 내용을 확인해 주세요.')}
  const input=parseAuthInput(action as AuthAction,body);
  switch(input.action){
   case 'sign-in':await signIn(input.email,input.password);break;
   case 'sign-up':await signUp(input.email,input.password);break;
   case 'request-reset':await requestPasswordReset(input.email);break;
   case 'update-password':await updatePassword(input.password);break;
   case 'sign-out':await signOut();break;
  }
  const nextPath=input.action==='sign-out'?'/login':'next' in input?safeNextPath(input.next):'/';
  return Response.json({data:{nextPath}},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return errorResponse(error)}
}
