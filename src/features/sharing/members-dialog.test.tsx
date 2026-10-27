// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MembersDialog} from './members-dialog';
const created={inviteId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',token:'a'.repeat(43),expiresAt:'2026-11-03T00:00:00Z'};
const people=[{userId:'owner',displayName:'냉장고 주인',role:'owner'},{userId:'member',displayName:'함께 쓰는 사람',role:'member'}];
const reply=(data:unknown)=>new Response(JSON.stringify({data}),{status:200});
beforeEach(()=>vi.spyOn(document,'visibilityState','get').mockReturnValue('visible'));
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()});
it('late_invite_list_does_not_erase_a_newly_created_link',async()=>{
 let finish!:(response:Response)=>void;
 vi.stubGlobal('fetch',vi.fn((url:RequestInfo|URL,init?:RequestInit)=>init?.method==='POST'?Promise.resolve(reply(created)):String(url).endsWith('/members')?Promise.resolve(reply(people)):new Promise<Response>(resolve=>{finish=resolve})));
 render(<MembersDialog fridgeId="fixture" role="owner" onClose={()=>{}} onLeft={()=>{}}/>);
 await waitFor(()=>expect(typeof finish).toBe('function'));
 fireEvent.click(screen.getByRole('button',{name:'초대 링크 만들기'}));await screen.findByLabelText('초대 링크');
 await act(async()=>finish(reply([])));
 expect(screen.getByLabelText('초대 링크')).toHaveValue(new URL('/invite/'+created.token,window.location.origin).toString());
});
it('ordinary_member_is_offered_leave_without_owner_controls',async()=>{
 vi.stubGlobal('fetch',vi.fn(()=>Promise.resolve(reply(people))));
 render(<MembersDialog fridgeId="fixture" role="member" onClose={()=>{}} onLeft={()=>{}}/>);
 await screen.findByText('함께 쓰는 사람');expect(screen.getByRole('button',{name:'냉장고 나가기'})).toBeVisible();
 expect(screen.queryByRole('button',{name:'초대 링크 만들기'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'함께 쓰는 사람 내보내기'})).not.toBeInTheDocument();
});
