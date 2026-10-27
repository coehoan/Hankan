'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { parseAuthInput,type AuthAction } from './validation';
import { safeNextPath } from './redirects';

type FormAction=Exclude<AuthAction,'sign-out'>;
const copy:Record<FormAction,{title:string;description:string;submit:string}>={
 'sign-in':{title:'다시 만나 반가워요',description:'로그인하고 내 냉장고를 확인해 보세요.',submit:'로그인'},
 'sign-up':{title:'싱싱한 일상을 시작해요',description:'나만의 냉장고를 만들고 재료를 정리해 보세요.',submit:'회원가입'},
 'request-reset':{title:'비밀번호를 잊으셨나요?',description:'가입한 이메일로 재설정 링크를 보내드릴게요.',submit:'재설정 메일 받기'},
 'update-password':{title:'새 비밀번호를 정해 주세요',description:'앞으로 사용할 비밀번호를 입력해 주세요.',submit:'비밀번호 변경'},
};

export function AuthForm({mode,nextPath='/',notice}:{mode:FormAction;nextPath?:string;notice?:string}){
 const router=useRouter();
 const [pending,setPending]=useState(false);
 const [error,setError]=useState(notice==='link-expired'?'링크가 만료되었거나 확인되지 않았어요. 메일을 요청한 브라우저에서 다시 시도해 주세요.':'');
 const [success,setSuccess]=useState('');
 const text=copy[mode];
 async function submit(event:React.SubmitEvent<HTMLFormElement>){
  event.preventDefault();if(pending)return;
  const fields=new FormData(event.currentTarget);
  setError('');setSuccess('');setPending(true);
  try{
   const input=parseAuthInput(mode,{email:fields.get('email'),password:fields.get('password'),next:safeNextPath(nextPath)});
   const response=await fetch('/api/auth/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error?.message??'요청을 완료하지 못했어요.');
   if(mode==='sign-up'){setSuccess('확인 메일을 보냈어요. 이 브라우저에서 메일의 링크를 열어 가입을 완료해 주세요.');return}
   if(mode==='request-reset'){setSuccess('가입된 이메일이라면 재설정 링크를 보내드렸어요. 이 브라우저에서 메일을 확인해 주세요.');return}
   router.replace(safeNextPath(result.data?.nextPath));
   router.refresh();
  }catch(caught){setError(caught instanceof Error?caught.message:'연결을 확인하고 다시 시도해 주세요.')}
  finally{setPending(false)}
 }
 return <div className="auth-card"><p className="eyebrow">YOUR FRESH START</p><h2>{text.title}</h2><p className="form-description">{text.description}</p><form onSubmit={submit} aria-label={text.submit}>
  {mode!=='update-password'&&<label className="field">이메일<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} disabled={pending}/></label>}
  {mode!=='request-reset'&&<label className="field">{mode==='update-password'?'새 비밀번호':'비밀번호'}<input name="password" type="password" autoComplete={mode==='sign-in'?'current-password':'new-password'} placeholder="8자 이상 입력해 주세요" required minLength={8} maxLength={72} disabled={pending}/></label>}
  {mode==='sign-in'&&<div className="forgot-row"><Link href="/reset-password">비밀번호를 잊으셨나요?</Link></div>}
  {error&&<p className="form-message error" role="alert">{error}</p>}
  {success&&<p className="form-message success" role="status">{success}</p>}
  <button className="primary-button" type="submit" disabled={pending}>{pending?'잠시만 기다려 주세요':text.submit}<span aria-hidden="true">↗</span></button>
 </form>{mode==='sign-in'?<p className="switch-auth">아직 한칸 계정이 없나요? <Link href={'/signup?next='+encodeURIComponent(safeNextPath(nextPath))}>회원가입</Link></p>:<p className="switch-auth"><Link href={'/login?next='+encodeURIComponent(safeNextPath(nextPath))}>로그인으로 돌아가기</Link></p>}</div>;
}
