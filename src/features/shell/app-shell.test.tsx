// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {AppShell} from './app-shell';
vi.mock('next/navigation',()=>({useRouter:()=>({push:()=>{},replace:()=>{},refresh:()=>{}})}));
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('closing_members_does_not_leave_a_duplicate_dialog_or_inventory',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({data:[]}))));
 render(<AppShell fridges={[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'우리집',role:'owner'}]} selectedId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" initialToday="2026-10-28" timeZone="Asia/Seoul"/>);
 fireEvent.click(screen.getByRole('button',{name:'멤버 관리'}));await screen.findByRole('dialog',{name:'함께 쓰는 사람들'});
 fireEvent.click(screen.getByRole('button',{name:'함께 쓰는 사람들 닫기'}));
 await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
 fireEvent.click(screen.getByRole('button',{name:'재료 등록'}));expect(screen.getAllByRole('dialog')).toHaveLength(1);
});
it('notification_settings_link_opens_mypage_instead_of_a_modal',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>Response.json({data:String(url).endsWith('/notifications')?{enabled:false,localTime:'09:00',timezone:'Asia/Seoul',nextRunAt:null}:[]})));
 render(<AppShell fridges={[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'우리집',role:'owner'}]} selectedId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" initialToday="2026-10-28" timeZone="Asia/Seoul"/>);
 expect(screen.getByRole('link',{name:'알림 설정'})).toHaveAttribute('href','/mypage#notifications');expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'멤버 관리'}));expect(await screen.findByRole('dialog',{name:'함께 쓰는 사람들'})).toBeVisible();expect(screen.getAllByRole('dialog')).toHaveLength(1);
});
