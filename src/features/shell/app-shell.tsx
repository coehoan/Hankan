'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brand } from '@/features/auth/auth-frame';
import { SignOutButton } from '@/features/auth/sign-out-button';
import { InventoryScreen } from '@/features/inventory/inventory-screen';
import { FridgeSwitcher } from './fridge-switcher';
import type { FridgeSummary } from './contracts';
export function AppShell({fridges,selectedId,initialToday,timeZone}:{fridges:FridgeSummary[];selectedId:string;initialToday:string;timeZone:string}){
 const router=useRouter(),[switching,setSwitching]=useState(false),[error,setError]=useState(''),[online,setOnline]=useState(true);
 const switchingRef=useRef(false),selected=fridges.find(fridge=>fridge.id===selectedId)!;
 useEffect(()=>{const sync=()=>setOnline(navigator.onLine!==false);sync();window.addEventListener('online',sync);window.addEventListener('offline',sync);return()=>{window.removeEventListener('online',sync);window.removeEventListener('offline',sync)}},[]);
 const accessLost=useCallback(()=>{router.replace('/');router.refresh()},[router]);
 async function select(id:string){
  if(id===selectedId||switchingRef.current||!online||!fridges.some(fridge=>fridge.id===id))return;
  switchingRef.current=true;setSwitching(true);setError('');
  try{
   const response=await fetch('/api/fridges',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fridgeId:id})});
   const json=await response.json();if(!response.ok){if(response.status===401||response.status===403)accessLost();throw new Error(json.error?.message??'냉장고를 열지 못했어요.')}
   router.push('/fridges/'+id);
  }catch(caught){setError(caught instanceof Error?caught.message:'연결을 확인해 주세요.')}
  finally{switchingRef.current=false;setSwitching(false)}
 }
 return <div className="pantry-app"><header className="pantry-header"><div><Brand/><nav aria-label="메인 메뉴"><span aria-current="page">내 냉장고</span></nav><SignOutButton/></div></header><div className="pantry-context"><FridgeSwitcher fridges={fridges} selectedId={selectedId} onSelect={id=>void select(id)} disabled={switching||!online}/><span className="fridge-role">{selected.role==='owner'?'내 소유':'함께 관리'}</span>{switching&&<p role="status">냉장고를 열고 있어요…</p>}</div>{error&&<p className="shell-error" role="alert">{error}</p>}<InventoryScreen key={selectedId} fridgeId={selectedId} fridgeName={selected.name} initialToday={initialToday} timeZone={timeZone} onAccessLost={accessLost}/><footer className="pantry-footer">한칸<span>냉장고를 가볍게, 한 끼를 맛있게.</span></footer></div>;
}
