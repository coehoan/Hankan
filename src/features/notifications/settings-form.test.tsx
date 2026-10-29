// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {NotificationSettingsForm} from './settings-form';
const original={enabled:false,localTime:'09:00',timezone:'Asia/Seoul',nextRunAt:null as string|null};
let saved={...original},fail=false,patches=0,online=true;
beforeEach(()=>{saved={...original};fail=false;patches=0;online=true;vi.spyOn(navigator,'onLine','get').mockImplementation(()=>online);vi.stubGlobal('fetch',async(_url:unknown,init?:RequestInit)=>{if(init?.method==='PATCH'){patches++;if(fail)return Response.json({error:{message:'설정을 저장하지 못했어요.'}},{status:500});const input=JSON.parse(String(init.body));saved={...saved,...input,nextRunAt:input.enabled?'2026-10-26T11:30:00Z':null}}return Response.json({data:saved})})});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()});
const show=()=>render(<NotificationSettingsForm/>);
const ready=()=>screen.findByRole('switch',{name:'알림 받기'});
it('off_hides_save_and_time_and_ignores_direct_form_submission',async()=>{
 show();const toggle=await ready();expect(toggle).not.toBeChecked();expect(screen.queryByRole('button',{name:'저장'})).not.toBeInTheDocument();expect(screen.queryByLabelText('매일 받을 시각')).not.toBeInTheDocument();fireEvent.submit(toggle.closest('form')!);expect(patches).toBe(0);
});
it('on_is_draft_only_until_explicit_save',async()=>{
 show();fireEvent.click(await ready());expect(screen.getByLabelText('매일 받을 시각')).toHaveValue('09:00');expect(patches).toBe(0);fireEvent.change(screen.getByLabelText('매일 받을 시각'),{target:{value:'20:30'}});fireEvent.click(screen.getByRole('button',{name:'저장'}));await screen.findByText('알림 설정을 저장했어요.');expect(saved).toMatchObject({enabled:true,localTime:'20:30'});expect(patches).toBe(1);
});
it('failed_on_save_keeps_draft_for_retry',async()=>{
 fail=true;show();fireEvent.click(await ready());fireEvent.change(screen.getByLabelText('매일 받을 시각'),{target:{value:'20:30'}});fireEvent.click(screen.getByRole('button',{name:'저장'}));await screen.findByRole('alert');expect(screen.getByLabelText('매일 받을 시각')).toHaveValue('20:30');expect(saved.enabled).toBe(false);fail=false;fireEvent.click(screen.getByRole('button',{name:'저장'}));await screen.findByText('알림 설정을 저장했어요.');expect(saved.enabled).toBe(true);
});
it('off_saves_immediately_even_with_a_cleared_time',async()=>{
 saved={...saved,enabled:true};show();await ready();fireEvent.change(screen.getByLabelText('매일 받을 시각'),{target:{value:''}});fireEvent.click(screen.getByRole('switch',{name:'알림 받기'}));await screen.findByText('알림을 껐어요.');expect(saved).toMatchObject({enabled:false,localTime:'09:00',nextRunAt:null});expect(patches).toBe(1);expect(screen.queryByRole('button',{name:'저장'})).not.toBeInTheDocument();
});
it('reopening_restores_off_and_on_reveals_last_saved_time_without_enabling_server',async()=>{
 saved={...saved,enabled:true,localTime:'20:30'};let view=show();fireEvent.click(await ready());await screen.findByText('알림을 껐어요.');view.unmount();view=show();expect(await ready()).not.toBeChecked();fireEvent.click(screen.getByRole('switch'));expect(screen.getByLabelText('매일 받을 시각')).toHaveValue('20:30');expect(saved.enabled).toBe(false);expect(patches).toBe(1);
});
it('failed_off_restores_previous_draft_instead_of_claiming_off',async()=>{
 saved={...saved,enabled:true};fail=true;show();await ready();fireEvent.change(screen.getByLabelText('매일 받을 시각'),{target:{value:'22:30'}});fireEvent.click(screen.getByRole('switch'));await screen.findByRole('alert');expect(screen.getByRole('switch')).toBeChecked();expect(screen.getByLabelText('매일 받을 시각')).toHaveValue('22:30');expect(saved.enabled).toBe(true);fail=false;fireEvent.click(screen.getByRole('switch'));await screen.findByText('알림을 껐어요.');expect(saved.enabled).toBe(false);
});
it('pending_off_blocks_duplicate_toggles_until_response',async()=>{
 saved={...saved,enabled:true};let finish!:(value:Response)=>void;vi.stubGlobal('fetch',async(_url:unknown,init?:RequestInit)=>init?.method==='PATCH'?(patches++,new Promise<Response>(resolve=>{finish=resolve})):Response.json({data:saved}));show();fireEvent.click(await ready());expect(screen.getByRole('switch')).toBeDisabled();fireEvent.click(screen.getByRole('switch'));expect(patches).toBe(1);expect(screen.queryByRole('button',{name:'저장'})).not.toBeInTheDocument();await act(async()=>finish(Response.json({data:{...saved,enabled:false,nextRunAt:null}})));expect(screen.getByRole('switch')).not.toBeChecked();expect(screen.getByRole('switch')).toBeEnabled();
});
it('offline_blocks_toggle_and_save_without_losing_draft',async()=>{
 saved={...saved,enabled:true};show();await ready();act(()=>{online=false;window.dispatchEvent(new Event('offline'))});expect(screen.getByRole('switch')).toBeDisabled();expect(screen.getByRole('button',{name:'저장'})).toBeDisabled();expect(screen.getByLabelText('매일 받을 시각')).toHaveValue('09:00');expect(patches).toBe(0);
});
it('failed_load_has_no_fake_defaults_and_can_retry',async()=>{
 let bad=true;vi.stubGlobal('fetch',async()=>bad?Response.json({error:{message:'설정을 불러오지 못했어요.'}},{status:500}):Response.json({data:saved}));show();await screen.findByRole('alert');expect(screen.queryByRole('switch')).not.toBeInTheDocument();bad=false;fireEvent.click(screen.getByRole('button',{name:'설정 다시 불러오기'}));expect(await ready()).not.toBeChecked();
});
