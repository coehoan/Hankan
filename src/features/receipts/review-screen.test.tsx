// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ReviewScreen} from './review-screen';
const draft={draftId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',fridgeId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',fridgeName:'처음 선택한 냉장고',status:'ready' as const,expiresAt:'2099-01-01T00:00:00Z',originalUrl:null,items:[{id:'one',rawText:'풀무원두부',suggestedName:'두부',needsReview:true}]};
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks()});
it('dates_start_empty_and_are_required',async()=>{
 render(<ReviewScreen draft={draft} onSaved={()=>{}} onCancel={()=>{}}/>);
 expect(screen.getByLabelText('유통기한 1')).toHaveValue('');
 expect(screen.getByRole('button',{name:'확인한 재료 저장'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('유통기한 1'),{target:{value:'2026-11-05'}});
 expect(screen.getByRole('button',{name:'확인한 재료 저장'})).toBeEnabled();
});
it('only_explicit_save_imports_into_the_original_fridge',async()=>{
 let writes=0;let body:unknown;vi.stubGlobal('fetch',vi.fn(async(_url:unknown,init?:RequestInit)=>{writes++;body=JSON.parse(String(init?.body));return new Response(JSON.stringify({data:[]}))}));
 render(<ReviewScreen draft={draft} onSaved={()=>{}} onCancel={()=>{}}/>);expect(writes).toBe(0);
 fireEvent.change(screen.getByLabelText('재료 이름 1'),{target:{value:'손질한 두부'}});fireEvent.change(screen.getByLabelText('유통기한 1'),{target:{value:'2026-11-05'}});
 expect(screen.getByText(/처음 선택한 냉장고/)).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'확인한 재료 저장'}));await waitFor(()=>expect(writes).toBe(1));
 expect(body).toEqual({requestId:expect.any(String),items:[{name:'손질한 두부',storage:'fridge',expiresOn:'2026-11-05'}]});
});
it('offline_keeps_review_inputs_and_disables_import',()=>{
 vi.spyOn(navigator,'onLine','get').mockReturnValue(true);render(<ReviewScreen draft={draft} onSaved={()=>{}} onCancel={()=>{}}/>);
 fireEvent.change(screen.getByLabelText('유통기한 1'),{target:{value:'2026-11-05'}});
 vi.spyOn(navigator,'onLine','get').mockReturnValue(false);act(()=>window.dispatchEvent(new Event('offline')));
 expect(screen.getByRole('button',{name:'확인한 재료 저장'})).toBeDisabled();expect(screen.getByLabelText('유통기한 1')).toHaveValue('2026-11-05');
});
it('resumes_saved_review_with_its_empty_date',()=>{
 render(<ReviewScreen draft={{...draft,reviewItems:[{id:'one',name:'내가 고친 두부',storage:'pantry',expiresOn:'',included:true,rawText:'두부',needsReview:false}]}} onSaved={()=>{}} onCancel={()=>{}}/>);
 expect(screen.getByLabelText('재료 이름 1')).toHaveValue('내가 고친 두부');expect(screen.getByLabelText('유통기한 1')).toHaveValue('');expect(screen.getByRole('button',{name:'확인한 재료 저장'})).toBeDisabled();
});
it('recovered_analysis_enables_retry_and_manual_editing_without_losing_review_rows',async()=>{
 const reviewItems=[{id:'one',name:'저장한 두부',storage:'pantry' as const,expiresOn:'',included:true,rawText:'두부',needsReview:false}];
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({data:{...draft,status:'failed',reviewItems}})));
 render(<ReviewScreen draft={{...draft,status:'analyzing',reviewItems}} onSaved={()=>{}} onCancel={()=>{}}/>);
 expect(screen.getByRole('button',{name:'품목 직접 추가'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'사진·상태 다시 확인'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'AI로 품목 읽기'})).toBeEnabled());
 expect(screen.getByLabelText('재료 이름 1')).toBeEnabled();expect(screen.getByLabelText('재료 이름 1')).toHaveValue('저장한 두부');expect(screen.getByLabelText('유통기한 1')).toHaveValue('');
 expect(screen.getByRole('button',{name:'품목 직접 추가'})).toBeEnabled();
});
