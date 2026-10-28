'use client';
import {Button} from '@/components/ui/button';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import type {InviteInfo} from './contracts';
const unavailable={expired:'만료된 초대예요.',revoked:'취소된 초대예요.',used:'이미 사용된 초대예요.'};
export function InviteScreen({token}:{token:string}){
 const router=useRouter(),[info,setInfo]=useState<InviteInfo|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false),[joined,setJoined]=useState(false),[online,setOnline]=useState(true),[retry,setRetry]=useState(0);
 const sending=useRef(false);
 useEffect(()=>{const controller=new AbortController();let active=true;void fetch('/api/invites/'+encodeURIComponent(token),{cache:'no-store',signal:controller.signal}).then(async response=>{const json=await response.json();if(!response.ok)throw new Error(json.error?.message??'초대를 확인하지 못했어요.');if(active){setInfo(json.data);setError('')}}).catch(caught=>{if(active&&!controller.signal.aborted)setError(caught instanceof Error?caught.message:'연결을 확인해 주세요.')});return()=>{active=false;controller.abort()}},[token,retry]);
 useEffect(()=>{const sync=()=>setOnline(navigator.onLine!==false);sync();window.addEventListener('online',sync);window.addEventListener('offline',sync);return()=>{window.removeEventListener('online',sync);window.removeEventListener('offline',sync)}},[]);
 async function accept(){
  if(sending.current||!online)return;sending.current=true;setPending(true);setError('');
  try{const response=await fetch('/api/invites/'+encodeURIComponent(token),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const json=await response.json();if(!response.ok)throw new Error(json.error?.message??'참여하지 못했어요.');setJoined(true);router.replace('/fridges/'+encodeURIComponent(json.data.id));router.refresh()}
  catch(caught){setError(caught instanceof Error?caught.message:'연결을 확인해 주세요.')}
  finally{sending.current=false;setPending(false)}
 }
 return <section className="invitation-card"><span className="invite-mark" aria-hidden="true">✳</span><p className="eyebrow">A LITTLE FRESHER, TOGETHER</p><p className="invite-kicker">함께 쓰는 냉장고로 초대받았어요</p>{info?<><h1>{info.fridgeName}</h1><p className="invite-permissions">재료 추가·수정·남은 양 변경·삭제를 함께 할 수 있어요.</p><p className="invite-personal">내 냉장고의 기존 재료는 옮겨지거나 합쳐지지 않아요.</p>{info.state==='valid'?<Button onClick={()=>void accept()} disabled={pending||!online||joined}>{pending?'참여 중…':'이 냉장고에 참여'}</Button>:info.state==='already_member'?<><p className="invite-state">이미 함께 쓰고 있는 냉장고예요.</p><Link className="add-button" href={'/fridges/'+info.fridgeId}>냉장고 열기</Link></>:<><p className="invite-state">{unavailable[info.state]}</p><p className="muted">소유자에게 새 초대 링크를 요청해 주세요.</p></>}</>:!error&&<p role="status">초대 내용을 확인하고 있어요…</p>}{joined&&<p role="status">냉장고에 참여했어요. 목록으로 이동합니다.</p>}{error&&<p className="form-message error" role="alert">{error}</p>}{!online&&<p className="invite-state">연결이 돌아오면 참여할 수 있어요.</p>}{!info&&error&&<Button variant="text" onClick={()=>setRetry(value=>value+1)}>다시 확인</Button>}<Link className="invite-back" href="/">내 냉장고로 돌아가기</Link></section>;
}
