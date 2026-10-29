'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ThemeSelector} from './theme-provider';
import {SignOutButton} from '@/features/auth/sign-out-button';
import {PushControls} from '@/features/notifications/push-controls';
import {SettingsDialog} from '@/features/notifications/settings-dialog';
import {preferenceResponse,type NotificationPreferences} from '@/features/notifications/contracts';
import {Button} from '@/components/ui/button';

export function MyPage({onAccessLost}:{onAccessLost:()=>void}){
 const [preferences,setPreferences]=useState<NotificationPreferences|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[scheduleOpen,setScheduleOpen]=useState(false);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  async function load(){
   setLoading(true);setError('');
   try{
    const response=await fetch('/api/settings/notifications',{cache:'no-store',signal:controller.signal}),json=await response.json();
    if(!response.ok){if([401,403].includes(response.status))onAccessLost();throw new Error(json.error?.message??'알림 정보를 불러오지 못했어요.')}
    const parsed=preferenceResponse.safeParse(json.data);if(!parsed.success)throw new Error('알림 정보를 확인하지 못했어요.');
    if(active)setPreferences(parsed.data);
   }catch(caught){if(active)setError(caught instanceof Error?caught.message:'연결을 확인해 주세요.')}finally{if(active)setLoading(false)}
  }
  void load();return()=>{active=false;controller.abort()};
 },[revision,onAccessLost]);
 return <main className="my-page"><header className="my-page-heading"><h1>마이페이지</h1><p>내 계정과 알림을 관리해요.</p></header>
  <section className="my-page-card"><h2>화면 설정</h2><ThemeSelector/></section>
  <section className="my-page-card"><h2>계정 관리</h2><div className="my-page-actions"><Link className="secondary-button" href="/change-password">비밀번호 변경</Link><SignOutButton/></div></section>
  <section className="my-page-card"><div className="my-page-section-heading"><h2>알림</h2><Button variant="secondary" onClick={()=>setScheduleOpen(true)}>알림 일정 설정</Button></div>
   {loading?<p role="status">알림 연결 정보를 불러오고 있어요…</p>:error?<><p role="alert">{error}</p><Button variant="secondary" onClick={()=>setRevision(value=>value+1)}>다시 불러오기</Button></>:preferences?<PushControls key={revision} enabled={preferences.enabled}/>:null}
  </section>
  {scheduleOpen&&<SettingsDialog onAccessLost={onAccessLost} onClose={()=>{setScheduleOpen(false);setRevision(value=>value+1)}}/>}
 </main>;
}
