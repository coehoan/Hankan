'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {RecipeList} from '@/features/recipes/recipe-list';
import { Brand } from '@/features/auth/auth-frame';
import { MyPage } from './my-page';
import { InventoryScreen } from '@/features/inventory/inventory-screen';
import { FridgeSwitcher } from './fridge-switcher';
import type { FridgeSummary } from './contracts';
import { MembersDialog } from '@/features/sharing/members-dialog';
import {UploadForm} from '@/features/receipts/upload-form';
import {SettingsDialog} from '@/features/notifications/settings-dialog';
import {RenameFridgeDialog} from './rename-fridge-dialog';
export function AppShell({fridges,selectedId,initialToday,timeZone,view='inventory'}:{view?:'inventory'|'recipes'|'mypage';fridges:FridgeSummary[];selectedId:string;initialToday:string;timeZone:string}){
 const router=useRouter(),[switching,setSwitching]=useState(false),[error,setError]=useState(''),[online,setOnline]=useState(true);
 const switchingRef=useRef(false),selected=fridges.find(fridge=>fridge.id===selectedId)!;
 const [notificationsOpen,setNotificationsOpen]=useState(false);
 const [renaming,setRenaming]=useState(false);
 const [membersFor,setMembersFor]=useState<string|null>(null),[receiptFor,setReceiptFor]=useState<string|null>(null);
 useEffect(()=>{const sync=()=>setOnline(navigator.onLine!==false);sync();window.addEventListener('online',sync);window.addEventListener('offline',sync);return()=>{window.removeEventListener('online',sync);window.removeEventListener('offline',sync)}},[]);
 const accessLost=useCallback(()=>{router.replace('/');router.refresh()},[router]);
 async function select(id:string){
  if(id===selectedId||switchingRef.current||!online||!fridges.some(fridge=>fridge.id===id))return;
  switchingRef.current=true;setSwitching(true);setError('');
  try{
   const response=await fetch('/api/fridges',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fridgeId:id})});
   const json=await response.json();if(!response.ok){if(response.status===401||response.status===403)accessLost();throw new Error(json.error?.message??'냉장고를 열지 못했어요.')}
   router.push('/fridges/'+id+(view==='recipes'?'/recipes':''));
  }catch(caught){setError(caught instanceof Error?caught.message:'연결을 확인해 주세요.')}
  finally{switchingRef.current=false;setSwitching(false)}
 }
 return <div className="pantry-app"><header className="pantry-header"><div><Link className="brand-link" href={'/fridges/'+selectedId}><Brand/></Link><nav aria-label="메인 메뉴"><Link href={'/fridges/'+selectedId} aria-current={view==='inventory'?'page':undefined}>내 냉장고</Link><Link href={'/fridges/'+selectedId+'/recipes'} aria-current={view==='recipes'?'page':undefined}>요리 추천</Link><Link href="/mypage" aria-current={view==='mypage'?'page':undefined}>마이페이지</Link></nav></div></header>{view!=='mypage'&&<div className="pantry-context"><FridgeSwitcher fridges={fridges} selectedId={selectedId} onSelect={id=>void select(id)} disabled={switching||!online}/><button className="rename-fridge-trigger" aria-label="냉장고 이름 변경" title="냉장고 이름 변경" onClick={()=>setRenaming(true)} disabled={!online||switching}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15l-1 5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></button><span className="fridge-role">{selected.role==='owner'?'내 소유':'함께 관리'}</span><button className="secondary-button" onClick={()=>setReceiptFor(selectedId)} disabled={!online||switching}>영수증 등록</button><button className="secondary-button members-toggle" onClick={()=>setMembersFor(current=>current===selectedId?null:selectedId)} aria-haspopup="dialog" aria-expanded={membersFor===selectedId}>멤버 관리</button><button className="secondary-button" onClick={()=>setNotificationsOpen(true)} aria-haspopup="dialog" aria-expanded={notificationsOpen}>알림 설정</button>{switching&&<p role="status">냉장고를 열고 있어요…</p>}</div>}{error&&<p className="shell-error" role="alert">{error}</p>}{renaming&&<RenameFridgeDialog key={selectedId} fridgeId={selectedId} name={selected.name} onClose={()=>setRenaming(false)} onSaved={()=>{setRenaming(false);router.refresh()}} onAccessLost={accessLost}/>}{membersFor===selectedId&&<MembersDialog key={'members:'+selectedId} fridgeId={selectedId} role={selected.role} onClose={()=>setMembersFor(null)} onLeft={accessLost}/>}{receiptFor===selectedId&&<UploadForm key={'receipt:'+selectedId} fridgeId={selectedId} fridgeName={selected.name} onClose={()=>setReceiptFor(null)} onCreated={id=>router.push('/receipts/'+id)}/>}{notificationsOpen&&<SettingsDialog key="notification-settings" onClose={()=>setNotificationsOpen(false)} onAccessLost={accessLost}/>} {view==='mypage'?<MyPage onAccessLost={accessLost}/>:view==='recipes'?<RecipeList key={'recipes:'+selectedId} fridgeId={selectedId} fridgeName={selected.name} initialToday={initialToday} timeZone={timeZone} onAccessLost={accessLost}/>:<InventoryScreen key={'inventory:'+selectedId} fridgeId={selectedId} fridgeName={selected.name} initialToday={initialToday} timeZone={timeZone} onAccessLost={accessLost}/>}<footer className="pantry-footer">한칸<span>냉장고를 가볍게, 한 끼를 맛있게.</span></footer></div>;
}
