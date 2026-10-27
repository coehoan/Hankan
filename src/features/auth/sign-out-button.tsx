'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SignOutButton(){
 const router=useRouter();
 const [pending,setPending]=useState(false);
 const [error,setError]=useState('');
 async function signOut(){
  setPending(true);setError('');
  try{
   const response=await fetch('/api/auth/sign-out',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
   if(!response.ok)throw new Error('로그아웃하지 못했어요. 다시 시도해 주세요.');
   router.replace('/login');
   router.refresh();
  }catch(caught){setError(caught instanceof Error?caught.message:'연결을 확인해 주세요.');setPending(false)}
 }
 return <div className="sign-out"><button onClick={signOut} disabled={pending}>{pending?'로그아웃 중':'로그아웃'}</button>{error&&<span role="alert">{error}</span>}</div>;
}
