'use client';
import {createContext,useContext,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {isThemePreference,type ThemePreference} from './theme';
export type {ThemePreference} from './theme';
type ThemeContext={preference:ThemePreference;resolvedTheme:'light'|'dark';setPreference:(value:ThemePreference)=>void;error:string;saving:boolean};
const Context=createContext<ThemeContext|null>(null);
const subscribe=(changed:()=>void)=>{const media=window.matchMedia('(prefers-color-scheme: dark)');media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed)};
const snapshot=()=>window.matchMedia('(prefers-color-scheme: dark)').matches;
const serverSnapshot=()=>false;
function writeCookie(value:ThemePreference){document.cookie=`hankan-theme=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`}
export function ThemeProvider({children,initialPreference,userId}:{children:React.ReactNode;initialPreference:ThemePreference;userId?:string}){
 const [preference,setValue]=useState(initialPreference),[error,setError]=useState(''),[saving,setSaving]=useState(false),[cleared,setCleared]=useState(false);
 const osDark=useSyncExternalStore(subscribe,snapshot,serverSnapshot),queue=useRef(Promise.resolve()),revision=useRef(0),alive=useRef(true),identityCleared=useRef(false);
 useEffect(()=>{document.documentElement.dataset.theme=preference},[preference]);
 useEffect(()=>{alive.current=true;const clear=()=>{revision.current++;identityCleared.current=true;setCleared(true);setValue('system');writeCookie('system');setError('')};window.addEventListener('hankan:identity-cleared',clear);return()=>{alive.current=false;window.removeEventListener('hankan:identity-cleared',clear)}},[]);
 function setPreference(value:ThemePreference){
  if(!isThemePreference(value)||cleared)return;
  setValue(value);setError('');writeCookie(value);
  if(!userId)return;
  const version=++revision.current;setSaving(true);
  queue.current=queue.current.then(async()=>{
   if(!alive.current||identityCleared.current)return;
   try{
    const response=await fetch('/api/preferences/theme',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({preference:value})});
    if(!response.ok)throw new Error('화면 테마를 계정에 저장하지 못했어요. 다시 선택해 주세요.');
   }catch(caught){if(alive.current&&version===revision.current)setError(caught instanceof Error?caught.message:'연결을 확인해 주세요.')}
   finally{if(alive.current&&version===revision.current){writeCookie(value);setSaving(false)}}
  });
 }
 const value:ThemeContext={preference,resolvedTheme:preference==='system'?(osDark?'dark':'light'):preference,setPreference,error,saving};
 return <Context value={value}>{cleared?<main className="message-page" role="status">로그아웃했어요. 로그인 화면으로 이동합니다.</main>:children}</Context>;
}
export function useThemePreference(){const context=useContext(Context);if(!context)throw new Error('ThemeProvider가 필요합니다.');return context}
export function ThemeSelector(){
 const theme=useContext(Context);if(!theme)return null;
 return <div className="theme-control"><label><span>화면 테마</span><select aria-label="화면 테마" value={theme.preference} onChange={event=>theme.setPreference(event.target.value as ThemePreference)}><option value="system">시스템</option><option value="light">라이트</option><option value="dark">다크</option></select></label>{theme.saving&&<span className="theme-feedback" role="status">테마 저장 중…</span>}{theme.error&&<p className="theme-error" role="alert">{theme.error}</p>}</div>;
}
