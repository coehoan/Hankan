'use client';
import {useEffect,useId,useRef,useState} from 'react';
import Link from 'next/link';
import {SignOutButton} from '@/features/auth/sign-out-button';

export function ProfileMenu({accountName}:{accountName:string}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),id=useId();
 const name=accountName.trim()||'사용자',initial=[...name][0].toLocaleUpperCase('ko-KR');
 useEffect(()=>{
  if(!open)return;
  menu.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false)};
  document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
 },[open]);
 return <div className="profile-menu" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false)}} onKeyDown={event=>{
  if(event.key==='Escape'&&open){event.preventDefault();setOpen(false);trigger.current?.focus();return}
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  event.preventDefault();if(!open){setOpen(true);return}
  const items=Array.from(menu.current?.querySelectorAll<HTMLElement>('[role=menuitem]')??[]),index=items.indexOf(document.activeElement as HTMLElement);
  const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowUp'?-1:1)+items.length)%items.length;items[next]?.focus();
 }}>
  <button className="profile-avatar" ref={trigger} aria-label={name+' 계정 메뉴'} aria-haspopup="menu" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>setOpen(value=>!value)}>{initial}</button>
  {open&&<div className="profile-dropdown" ref={menu} id={id} role="menu" aria-label="계정 메뉴"><Link role="menuitem" href="/mypage" onClick={()=>setOpen(false)}>마이페이지</Link><Link role="menuitem" href="/fridges/manage" onClick={()=>setOpen(false)}>냉장고 관리</Link><SignOutButton menuItem/></div>}
 </div>;
}
