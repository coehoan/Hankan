// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
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
it('history_cleanup_keeps_active_link_and_uses_24_hour_expiry_display',async()=>{
 let links=[{id:created.inviteId,state:'valid',expiresAt:'2026-11-03T20:05:00Z'},{id:'old',state:'expired',expiresAt:'2020-01-01T00:00:00Z'}];const fetcher=vi.fn(async(url:unknown,init?:RequestInit)=>{
  if(init?.method==='DELETE'){expect(String(url)).toContain('/invites/history');links=links.filter(link=>link.state==='valid');return reply({deletedCount:1})}return reply(String(url).endsWith('/members')?people:links);
 });vi.stubGlobal('fetch',fetcher);render(<MembersDialog fridgeId="fixture" role="owner" onClose={()=>{}} onLeft={()=>{}}/>);
 const list=await screen.findByRole('list',{name:'만든 초대'});expect(screen.getByText(/새 초대 링크는 1일간 유효/)).toBeVisible();for(const time of list.querySelectorAll('time')){expect(time.textContent).not.toMatch(/오전|오후/);expect(time.textContent).toMatch(/\d{2}:\d{2}/)}
 fireEvent.click(screen.getByRole('button',{name:'초대 내역 전체 삭제'}));await screen.findByText(/1개의 초대 내역을 삭제/);expect(within(list).getByText('참여 가능')).toBeVisible();expect(within(list).queryByText('만료됨')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'초대 내역 전체 삭제'})).toBeDisabled();
});
it('failed_history_cleanup_preserves_history_and_allows_retry',async()=>{
 vi.stubGlobal('fetch',async(url:unknown,init?:RequestInit)=>init?.method==='DELETE'?Response.json({error:{message:'삭제하지 못했어요.'}},{status:500}):reply(String(url).endsWith('/members')?people:[{id:'old',state:'used',expiresAt:created.expiresAt}]));render(<MembersDialog fridgeId="fixture" role="owner" onClose={()=>{}} onLeft={()=>{}}/>);await screen.findByText('사용됨');fireEvent.click(screen.getByRole('button',{name:'초대 내역 전체 삭제'}));expect(await screen.findByRole('alert')).toHaveTextContent('삭제하지 못했어요.');expect(screen.getByText('사용됨')).toBeVisible();await waitFor(()=>expect(screen.getByRole('button',{name:'초대 내역 전체 삭제'})).toBeEnabled());
});
