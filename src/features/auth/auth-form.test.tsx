// @vitest-environment jsdom
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {AuthForm} from './auth-form';
const router=vi.hoisted(()=>({replace:vi.fn(),refresh:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>router}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.resetAllMocks()});
it('signup_uses_username_and_immediately_returns_to_the_invite',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({data:{nextPath:'/invite/token'}}));vi.stubGlobal('fetch',fetcher);
 render(<AuthForm mode="sign-up" nextPath="/invite/token"/>);expect(screen.queryByLabelText('이메일')).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('아이디'),{target:{value:'Fresh_User'}});fireEvent.change(screen.getByLabelText('비밀번호'),{target:{value:'new-password'}});fireEvent.submit(screen.getByRole('form',{name:'회원가입'}));
 await waitFor(()=>expect(router.replace).toHaveBeenCalledWith('/invite/token'));expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({username:'fresh_user'});expect(screen.queryByText(/확인 메일/)).not.toBeInTheDocument();
});
it('password_change_has_two_fields_and_mismatch_never_sends',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);render(<AuthForm mode="update-password"/>);
 fireEvent.change(screen.getByLabelText('새 비밀번호'),{target:{value:'new-password'}});fireEvent.change(screen.getByLabelText('새 비밀번호 확인'),{target:{value:'different-password'}});fireEvent.submit(screen.getByRole('form',{name:'비밀번호 변경'}));await screen.findByRole('alert');expect(fetcher).not.toHaveBeenCalled();
});
it('forgotten_password_is_admin_help_instead_of_email_flow',()=>{render(<AuthForm mode="sign-in"/>);expect(screen.getByText(/관리자에게.*초기화/)).toBeVisible();expect(screen.queryByRole('link',{name:'비밀번호를 잊으셨나요?'})).not.toBeInTheDocument()});
