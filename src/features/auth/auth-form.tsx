'use client';
import {Button} from '@/components/ui/button';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {parseAuthInput,type AuthAction} from './validation';
import {safeNextPath} from './redirects';
type FormAction=Exclude<AuthAction,'sign-out'>;
const copy:Record<FormAction,{title:string;description:string;submit:string}>={
 'sign-in':{title:'다시 만나 반가워요',description:'아이디로 로그인하고 내 냉장고를 확인해 보세요.',submit:'로그인'},
 'sign-up':{title:'싱싱한 일상을 시작해요',description:'아이디와 비밀번호로 가입하고 바로 시작해요.',submit:'회원가입'},
 'update-password':{title:'새 비밀번호를 정해 주세요',description:'같은 비밀번호를 두 번 입력해 주세요.',submit:'비밀번호 변경'},
};
export function AuthForm({mode,nextPath='/',onSuccess,onPendingChange,formId,externalSubmit=false}:{mode:FormAction;nextPath?:string;notice?:string;onSuccess?:()=>void;onPendingChange?:(pending:boolean)=>void;formId?:string;externalSubmit?:boolean}){
 const router=useRouter(),[pending,setPending]=useState(false),[error,setError]=useState(''),text=copy[mode];
 async function submit(event:React.SubmitEvent<HTMLFormElement>){
  event.preventDefault();if(pending)return;const fields=new FormData(event.currentTarget);setError('');setPending(true);onPendingChange?.(true);
  try{
   const input=parseAuthInput(mode,{username:fields.get('username'),password:fields.get('password'),confirmPassword:fields.get('confirmPassword'),next:safeNextPath(nextPath)});
   const response=await fetch('/api/auth/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}),result=await response.json();
   if(!response.ok)throw new Error(result.error?.message??'요청을 완료하지 못했어요.');
   if(onSuccess)onSuccess();else router.replace(safeNextPath(result.data?.nextPath));router.refresh();
  }catch(caught){setError(caught instanceof Error?caught.message:'연결을 확인하고 다시 시도해 주세요.')}finally{setPending(false);onPendingChange?.(false)}
 }
 return <div className="auth-card"><h2>{text.title}</h2><p className="form-description">{text.description}</p><form id={formId} onSubmit={submit} aria-label={text.submit}>
 {mode!=='update-password'&&<label className="field">아이디<input name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="영문·숫자·밑줄 4~24자" required minLength={4} maxLength={24} disabled={pending}/></label>}
 <label className="field">{mode==='update-password'?'새 비밀번호':'비밀번호'}<input name="password" type="password" autoComplete={mode==='sign-in'?'current-password':'new-password'} placeholder="8자 이상 입력해 주세요" required minLength={8} maxLength={72} disabled={pending}/></label>
 {mode==='update-password'&&<label className="field">새 비밀번호 확인<input name="confirmPassword" type="password" autoComplete="new-password" placeholder="한 번 더 입력해 주세요" required minLength={8} maxLength={72} disabled={pending}/></label>}

 {error&&<p className="form-message error" role="alert">{error}</p>}
 {!externalSubmit&&<Button className="primary-button" type="submit" disabled={pending}>{pending?'잠시만 기다려 주세요':text.submit}<span aria-hidden="true">↗</span></Button>}
 </form>{mode==='sign-in'?<p className="switch-auth">아직 한칸 계정이 없나요? <Link href={'/signup?next='+encodeURIComponent(safeNextPath(nextPath))}>회원가입</Link></p>:mode==='sign-up'?<p className="switch-auth"><Link href={'/login?next='+encodeURIComponent(safeNextPath(nextPath))}>로그인으로 돌아가기</Link></p>:null}</div>;
}
