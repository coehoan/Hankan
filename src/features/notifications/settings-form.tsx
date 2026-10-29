'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {preferenceInput,preferenceResponse,type NotificationPreferences} from './contracts';
export function NotificationSettingsForm({onAccessLost}:{onAccessLost?:()=>void}){
 const [saved,setSaved]=useState<NotificationPreferences|null>(null),[draft,setDraft]=useState({enabled:false,localTime:'09:00'}),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[online,setOnline]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
 const active=useRef(false),pending=useRef(false),request=useRef<AbortController|null>(null),accessLost=useRef(onAccessLost);
 useEffect(()=>{accessLost.current=onAccessLost},[onAccessLost]);
 const read=useCallback(async(response:Response)=>{const json=await response.json();if(!response.ok){if([401,403].includes(response.status))accessLost.current?.();throw new Error(json.error?.message??'알림 설정을 확인하지 못했어요.')};const parsed=preferenceResponse.safeParse(json.data);if(!parsed.success)throw new Error('알림 설정 응답을 확인하지 못했어요.');return parsed.data},[]);
 useEffect(()=>{active.current=true;let live=true;const controller=new AbortController();request.current=controller;
  const sync=()=>setOnline(navigator.onLine!==false);sync();window.addEventListener('online',sync);window.addEventListener('offline',sync);
  async function load(){setLoading(true);setError('');try{if(navigator.onLine===false)throw new Error('온라인으로 연결한 뒤 설정을 다시 불러와 주세요.');const value=await read(await fetch('/api/settings/notifications',{cache:'no-store',signal:controller.signal}));if(live){setSaved(value);setDraft({enabled:value.enabled,localTime:value.localTime})}}catch(caught){if(live)setError(caught instanceof Error?caught.message:'알림 설정을 불러오지 못했어요.')}finally{if(live)setLoading(false)}}void load();
  return()=>{live=false;active.current=false;controller.abort();request.current?.abort();window.removeEventListener('online',sync);window.removeEventListener('offline',sync)};
 },[read,revision]);
 async function save(event:React.FormEvent){event.preventDefault();if(!saved||pending.current||navigator.onLine===false)return;const localTime=!draft.enabled&&!preferenceInput.shape.localTime.safeParse(draft.localTime).success?saved.localTime:draft.localTime;const parsed=preferenceInput.safeParse({...draft,localTime});if(!parsed.success){setError('시각을 00:00부터 23:59 사이로 입력해 주세요.');return}
  pending.current=true;setSaving(true);setError('');setNotice('');const controller=new AbortController();request.current=controller;
  try{const value=await read(await fetch('/api/settings/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsed.data),signal:controller.signal}));if(active.current){setSaved(value);setDraft({enabled:value.enabled,localTime:value.localTime});setNotice('알림 설정을 저장했어요.')}}catch(caught){if(active.current)setError(caught instanceof Error?caught.message:'연결을 확인하고 다시 저장해 주세요.')}finally{pending.current=false;if(active.current)setSaving(false)}
 }
 return <div className="notification-settings">
  <p>내가 참여한 냉장고의 임박 재료를 매일 한 번 모아 알려드려요.</p>
  {!online&&<p className="connection-banner" role="status">오프라인이에요. 연결한 뒤 저장해 주세요.</p>}
  {loading?<p role="status">내 알림 설정을 불러오고 있어요…</p>:saved?<form onSubmit={event=>void save(event)} className="notification-form">
   <label className="notification-toggle ios-switch"><input type="checkbox" role="switch" checked={draft.enabled} onChange={event=>{setDraft(value=>({...value,enabled:event.target.checked}));setNotice('')}} disabled={saving}/><span className="ios-switch-track" aria-hidden="true"/><span>알림 받기</span></label>
   {draft.enabled&&<div className="notification-time-settings"><label>매일 받을 시각<input type="time" step="60" required value={draft.localTime} onChange={event=>{setDraft(value=>({...value,localTime:event.target.value}));setNotice('')}} disabled={saving}/></label><p className="notification-hint">오늘 아직 보내지 않았고 새 시각이 남아 있으면 오늘부터, 이미 지났거나 오늘 보냈으면 내일부터 적용해요. 이 설정은 내 계정에만 적용돼요.</p></div>}
   <Button type="submit" disabled={!online||saving}>{saving?'저장 중…':'알림 설정 저장'}</Button>
  </form>:<Button onClick={()=>setRevision(value=>value+1)} disabled={!online}>설정 다시 불러오기</Button>}
  {error&&<p role="alert" className="form-error">{error}</p>}{notice&&<p role="status" className="notification-success">{notice}</p>}
 </div>;
}
