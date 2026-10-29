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
it('mypage_has_inline_notifications_and_logout_at_the_bottom',async()=>{
 render(<ThemeProvider initialPreference="system"><AppShell view="mypage" fridges={[{id,name:'우리집',role:'member'}]} selectedId={id} initialToday="2026-10-29" timeZone="Asia/Seoul"/></ThemeProvider>);
 expect(await screen.findByRole('heading',{name:'마이페이지'})).toBeVisible();expect(screen.getByRole('radiogroup',{name:'화면 테마'})).toBeVisible();expect(screen.getByRole('link',{name:'비밀번호 변경'})).toHaveAttribute('href','/change-password');expect(await screen.findByLabelText('알림 받기')).toBeVisible();expect(screen.queryByRole('region',{name:'브라우저 알림 연결'})).not.toBeInTheDocument();
 expect(screen.getByRole('link',{name:'마이페이지'})).toHaveAttribute('aria-current','page');expect(screen.getByRole('link',{name:'요리 추천'})).not.toHaveAttribute('aria-current');
 const main=screen.getByRole('main');expect(main.lastElementChild).toContainElement(screen.getByRole('button',{name:'로그아웃'}));expect(screen.getByRole('button',{name:'로그아웃'}).closest('.my-page-logout')).not.toBeNull();fireEvent.click(screen.getByLabelText('알림 받기'));expect(screen.getByLabelText('매일 받을 시각')).toBeVisible();expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
