'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ThemeSelector} from '@/features/shell/theme-provider';
import {Button} from './button';
const focusable='button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';
function createHost(){if(typeof document==='undefined')return null;const node=document.createElement('div');node.className='dialog-portal';return node}
export function Dialog({open,title,onOpenChange,children,closeDisabled=false}:{open:boolean;title:string;onOpenChange:(open:boolean)=>void;children:React.ReactNode;closeDisabled?:boolean}){
 const [host]=useState(createHost);
 const panel=useRef<HTMLDivElement>(null),callback=useRef(onOpenChange),blocked=useRef(closeDisabled),titleId=useId();
 useEffect(()=>{callback.current=onOpenChange;blocked.current=closeDisabled},[onOpenChange,closeDisabled]);
 useEffect(()=>{
  if(!open||!host)return;
  const opener=document.activeElement as HTMLElement|null;document.body.append(host);
  const siblings=Array.from(document.body.children).filter(node=>node!==host) as HTMLElement[];
  const previous=siblings.map(node=>node.inert);siblings.forEach(node=>node.inert=true);
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const elements=()=>Array.from(panel.current?.querySelectorAll<HTMLElement>(focusable)??[]).filter(node=>!node.hidden&&node.getAttribute('aria-hidden')!=='true');
  const focus=()=>{const field=panel.current?.querySelector<HTMLElement>('input:not(:disabled),textarea:not(:disabled)');(field??elements()[0]??panel.current)?.focus()};focus();
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();if(!blocked.current)callback.current(false)}
   if(event.key==='Tab'){
    const nodes=elements(),first=nodes[0],last=nodes.at(-1);
    if(!nodes.length){event.preventDefault();panel.current?.focus()}
    else if(event.shiftKey&&(document.activeElement===first||!panel.current?.contains(document.activeElement))){event.preventDefault();last?.focus()}
    else if(!event.shiftKey&&(document.activeElement===last||!panel.current?.contains(document.activeElement))){event.preventDefault();first?.focus()}
   }
  };
  const contain=(event:FocusEvent)=>{if(!panel.current?.contains(event.target as Node))focus()};
  document.addEventListener('keydown',keyboard);document.addEventListener('focusin',contain);
  return()=>{document.removeEventListener('keydown',keyboard);document.removeEventListener('focusin',contain);siblings.forEach((node,i)=>node.inert=previous[i]);document.body.style.overflow=overflow;host.remove();if(opener?.isConnected)opener.focus()};
 },[open,host]);
 if(!open||!host)return null;
 return createPortal(<div className="dialog-backdrop"><div className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={panel}><header className="dialog-heading"><h2 id={titleId}>{title}</h2><Button variant="secondary" aria-label={title+' 닫기'} onClick={()=>onOpenChange(false)} disabled={closeDisabled}>닫기 <span aria-hidden="true">×</span></Button></header><div className="dialog-content">{children}</div><footer className="dialog-footer"><ThemeSelector/><span>Esc 키로 닫기</span></footer></div></div>,host);
}
