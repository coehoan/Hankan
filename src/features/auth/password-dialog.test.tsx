// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {PasswordDialog} from './password-dialog';
const router=vi.hoisted(()=>({replace:vi.fn(),refresh:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>router}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks()});
function fill(confirm='new-password-123'){fireEvent.change(screen.getByLabelText('새 비밀번호'),{target:{value:'new-password-123'}});fireEvent.change(screen.getByLabelText('새 비밀번호 확인'),{target:{value:confirm}})}
it('has_close_control_and_rejects_mismatched_passwords_without_request',async()=>{
 const close=vi.fn(),complete=vi.fn(),fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);render(<PasswordDialog onClose={close} onComplete={complete}/>);expect(screen.queryByRole('link',{name:'내 냉장고로'})).not.toBeInTheDocument();fill('different-password');fireEvent.submit(screen.getByRole('form',{name:'비밀번호 변경'}));await screen.findByRole('alert');expect(fetcher).not.toHaveBeenCalled();expect(complete).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'취소'}));expect(close).toHaveBeenCalledOnce();
});
it('blocks_close_while_saving_and_completes_without_navigating_away',async()=>{
 let resolve!:(value:Response)=>void;vi.stubGlobal('fetch',()=>new Promise<Response>(done=>{resolve=done}));const close=vi.fn(),complete=vi.fn();render(<PasswordDialog onClose={close} onComplete={complete}/>);fill();fireEvent.submit(screen.getByRole('form',{name:'비밀번호 변경'}));await waitFor(()=>expect(screen.getByRole('button',{name:'취소'})).toBeDisabled());fireEvent.keyDown(document,{key:'Escape'});expect(close).not.toHaveBeenCalled();await act(async()=>resolve(Response.json({data:{nextPath:'/'}})));expect(complete).toHaveBeenCalledOnce();expect(router.replace).not.toHaveBeenCalled();
});
it('failed_request_preserves_inputs_and_allows_retry_or_close',async()=>{
 vi.stubGlobal('fetch',async()=>Response.json({error:{message:'변경하지 못했어요.'}},{status:500}));const close=vi.fn();render(<PasswordDialog onClose={close} onComplete={()=>{}}/>);fill();fireEvent.submit(screen.getByRole('form',{name:'비밀번호 변경'}));expect(await screen.findByRole('alert')).toHaveTextContent('변경하지 못했어요.');expect(screen.getByLabelText('새 비밀번호')).toHaveValue('new-password-123');expect(screen.getByRole('button',{name:'취소'})).toBeEnabled();
});
it('footer_has_cancel_then_form_linked_submit_with_no_wide_submit_inside_form',async()=>{
 const fetcher=vi.fn(async()=>Response.json({data:{nextPath:'/'}})),complete=vi.fn();vi.stubGlobal('fetch',fetcher);render(<PasswordDialog onClose={()=>{}} onComplete={complete}/>);const cancel=screen.getByRole('button',{name:'취소'}),submit=screen.getByRole('button',{name:'비밀번호 변경',exact:true}),form=screen.getByRole('form',{name:'비밀번호 변경'});expect(cancel.parentElement).toBe(submit.parentElement);expect(cancel.nextElementSibling).toBe(submit);expect(form).not.toContainElement(submit);expect(submit).toHaveAttribute('form',form.id);fill();fireEvent.click(submit);await waitFor(()=>expect(complete).toHaveBeenCalledOnce());expect(fetcher).toHaveBeenCalledOnce();
});
