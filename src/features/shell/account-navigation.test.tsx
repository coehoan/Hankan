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
 const header=screen.getByRole('navigation',{name:'메인 메뉴'}).closest('header')!;expect(within(header).getByRole('link',{name:'한칸'})).toHaveAttribute('href','/fridges/'+id);expect(within(header).getByRole('link',{name:'마이페이지'})).toHaveAttribute('href','/mypage');expect(within(header).queryByRole('link',{name:'비밀번호 변경'})).not.toBeInTheDocument();expect(within(header).queryByRole('button',{name:'로그아웃'})).not.toBeInTheDocument();
});
it('mypage_contains_theme_password_logout_and_notification_connection_management',async()=>{
 render(<ThemeProvider initialPreference="system"><AppShell view="mypage" fridges={[{id,name:'우리집',role:'member'}]} selectedId={id} initialToday="2026-10-29" timeZone="Asia/Seoul"/></ThemeProvider>);
 expect(await screen.findByRole('heading',{name:'마이페이지'})).toBeVisible();expect(screen.getByLabelText('화면 테마')).toBeVisible();expect(screen.getByRole('link',{name:'비밀번호 변경'})).toHaveAttribute('href','/change-password');expect(screen.getByRole('button',{name:'로그아웃'})).toBeVisible();expect(await screen.findByRole('region',{name:'브라우저 알림 연결'})).toBeVisible();
 expect(screen.getByRole('link',{name:'마이페이지'})).toHaveAttribute('aria-current','page');expect(screen.getByRole('link',{name:'요리 추천'})).not.toHaveAttribute('aria-current');
 fireEvent.click(screen.getByRole('button',{name:'알림 일정 설정'}));expect(await screen.findByRole('dialog',{name:'알림 설정'})).toBeVisible();
});
