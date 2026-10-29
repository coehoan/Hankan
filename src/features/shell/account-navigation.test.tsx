// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {AppShell} from './app-shell';
import {ThemeProvider} from './theme-provider';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),replace:vi.fn(),refresh:vi.fn()})}));
beforeEach(()=>{vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));vi.stubGlobal('fetch',async(url:unknown)=>Response.json({data:String(url).endsWith('/notifications')?{enabled:false,localTime:'09:00',timezone:'Asia/Seoul',nextRunAt:null}:[]}))});
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('header_brand_opens_selected_inventory_and_account_controls_live_in_mypage',()=>{
 render(<AppShell fridges={[{id,name:'우리집',role:'member'}]} selectedId={id} initialToday="2026-10-29" timeZone="Asia/Seoul"/>);
 const header=screen.getByRole('link',{name:'한칸'}).closest('header')!;expect(within(header).getByRole('link',{name:'한칸'})).toHaveAttribute('href','/fridges/'+id);expect(within(header).queryByRole('link',{name:'마이페이지'})).not.toBeInTheDocument();expect(within(header).queryByRole('link',{name:'비밀번호 변경'})).not.toBeInTheDocument();expect(within(header).queryByRole('button',{name:'로그아웃'})).not.toBeInTheDocument();expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
it('mypage_has_keyboard_account_row_inline_notifications_and_no_logout',async()=>{
 render(<ThemeProvider initialPreference="system"><AppShell view="mypage" fridges={[{id,name:'우리집',role:'member'}]} selectedId={id} initialToday="2026-10-29" timeZone="Asia/Seoul"/></ThemeProvider>);
 expect(await screen.findByRole('heading',{name:'마이페이지'})).toBeVisible();expect(screen.getByRole('radiogroup',{name:'화면 테마'})).toBeVisible();const passwordRow=screen.getByRole('button',{name:'비밀번호 변경'});expect(passwordRow.tagName).toBe('DIV');expect(await screen.findByRole('switch',{name:'알림 받기'})).toBeVisible();expect(screen.queryByRole('region',{name:'브라우저 알림 연결'})).not.toBeInTheDocument();
 expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'로그아웃'})).not.toBeInTheDocument();fireEvent.click(screen.getByRole('switch',{name:'알림 받기'}));expect(screen.getByLabelText('매일 받을 시각')).toBeVisible();fireEvent.keyDown(passwordRow,{key:'Enter'});expect(screen.getByRole('dialog',{name:'비밀번호 변경'})).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'취소'}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
