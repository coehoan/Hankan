'use client';
import {createContext,useContext,useEffect,useId,useRef,useState,useSyncExternalStore} from 'react';
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
 const theme=useContext(Context),name=useId();if(!theme)return null;
 const descriptions={system:'시스템: 기기의 다크 모드 설정을 따릅니다.',light:'라이트: 밝은 화면으로 표시합니다.',dark:'다크: 어두운 화면으로 표시합니다.'};
 return <div className="theme-control theme-segmented"><div className="theme-options" role="radiogroup" aria-label="화면 테마">{(['system','light','dark'] as const).map(value=><label className="theme-option" key={value} data-selected={theme.preference===value}><input type="radio" name={name} checked={theme.preference===value} value={value} onChange={()=>theme.setPreference(value)}/><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{value==='system'?<><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M9 21h6m-3-4v4"/></>:value==='light'?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/></>:<path d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z"/>}</svg><span>{value==='system'?'시스템':value==='light'?'라이트':'다크'}</span></label>)}</div><p className="theme-mode-description">{descriptions[theme.preference]}</p>{theme.saving&&<span className="theme-feedback" role="status">테마 저장 중…</span>}{theme.error&&<p className="theme-error" role="alert">{theme.error}</p>}</div>;
}
