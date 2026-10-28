import {afterEach,expect,it,vi} from 'vitest';
import {createSelectedProvider,type AiUsage} from './selected-provider';
const image={bytes:new Uint8Array([1,2,3]),mimeType:'image/png' as const};
const item={rawText:'행사 두부 300g',suggestedName:'두부',needsReview:false};
const recipe={name:'두부구이',ingredients:[{name:'두부',amountText:'150g'},{name:'식용유',amountText:'1작은술'}],steps:['두부를 썰어요.','식용유를 두른 팬에 두부를 완전히 익혀요.'],prepMinutes:10,servings:1,origin:{kind:'generated'}};
const input={today:'2026-10-28',ingredients:[{id:'secret-ingredient-id',fridgeId:'secret-fridge-id',createdBy:'secret-user-id',updatedBy:'secret-user-id',name:'두부',normalizedName:'두부',storage:'fridge' as const,expiresOn:'2026-10-29',remainingPercent:60,version:1,createdAt:'2026-10-28T00:00:00Z',updatedAt:'2026-10-28T00:00:00Z'}]};
function apiResponse(value:unknown,overrides:Record<string,unknown>={}) {
 return Response.json({id:'resp_test',object:'response',created_at:1793145600,status:'completed',error:null,incomplete_details:null,model:'gpt-6-luna',output:[{id:'msg_test',type:'message',status:'completed',role:'assistant',content:[{type:'output_text',text:JSON.stringify(value),annotations:[],logprobs:[]}]}],usage:{input_tokens:3000,input_tokens_details:{cached_tokens:0},output_tokens:1800,output_tokens_details:{reasoning_tokens:1000},total_tokens:4800},...overrides});
}
const provider=(onUsage?:(usage:AiUsage)=>void)=>createSelectedProvider({apiKey:'local-test-key',model:'gpt-6-luna',onUsage});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();vi.restoreAllMocks()});
it('extracts_reviewable_items_using_selected_model_and_high_reasoning',async()=>{
 let sent:Record<string,unknown>={};
 vi.stubGlobal('fetch',async(_url:unknown,options:RequestInit)=>{sent=JSON.parse(String(options.body));return apiResponse({items:[item,{rawText:'판독 불가',suggestedName:'',needsReview:false}]})});
 const result=await provider().extractReceipt(image);
 expect(result).toEqual([expect.objectContaining({...item,id:expect.any(String)}),expect.objectContaining({suggestedName:'',needsReview:true})]);
 expect(sent).toMatchObject({model:'gpt-6-luna',reasoning:{effort:'high'},store:false,text:{format:{type:'json_schema',strict:true}}});
 expect(JSON.stringify(sent)).toContain('data:image/png;base64,AQID');
 expect(result[0].id).not.toBe(result[1].id);
});
it.each([{items:[{...item,suggestedName:42}]},{items:[{...item,unexpected:'value'}]},{items:'bad'}])('malformed_output_is_rejected %j',async payload=>{
 vi.stubGlobal('fetch',async()=>apiResponse(payload));
 await expect(provider().extractReceipt(image)).rejects.toMatchObject({code:'provider_failed'});
});
it('receipt_expiry_is_never_imported',async()=>{
 vi.stubGlobal('fetch',async()=>apiResponse({items:[{...item,expiresOn:'2099-01-01'}]}));
 await expect(provider().extractReceipt(image)).rejects.toMatchObject({code:'provider_failed'});
 vi.stubGlobal('fetch',async()=>apiResponse({items:[{...item,rawText:'두부 유통기한 2099-01-01'}]}));
 const rows=await provider().extractReceipt(image);expect(rows[0]).not.toHaveProperty('expiresOn');
});
it('generated_recipe_has_no_fabricated_catalog_source',async()=>{
 vi.stubGlobal('fetch',async()=>apiResponse({recipes:[{...recipe,origin:{kind:'catalog',provider:'invented',recordId:'fake',sourceUrl:'https://fake.invalid'}}]}));
 await expect(provider().recommendRecipes(input)).rejects.toMatchObject({code:'provider_failed'});
 vi.stubGlobal('fetch',async()=>apiResponse({recipes:[recipe]}));
 const rows=await provider().recommendRecipes(input);expect(rows[0]).toMatchObject({name:'두부구이',origin:{kind:'generated'}});expect(rows[0].origin).not.toHaveProperty('sourceUrl');
});
it('recipe_input_sends_food_data_without_account_or_fridge_identifiers',async()=>{
 let sent='';vi.stubGlobal('fetch',async(_url:unknown,options:RequestInit)=>{sent=String(options.body);return apiResponse({recipes:[recipe]})});
 expect((await provider().recommendRecipes(input))[0].ingredients).toHaveLength(2);
 expect(sent).toContain('두부');expect(sent).toContain('2026-10-29');expect(sent).toContain('60');expect(sent).not.toContain('secret-');
});
it.each(['incomplete','failed'])('rejects_%s_response_instead_of_saving_partial_items',async status=>{
 vi.stubGlobal('fetch',async()=>apiResponse({items:[item]},{status}));
 await expect(provider().extractReceipt(image)).rejects.toMatchObject({code:'provider_failed'});
});
it('refusal_is_recoverable_and_not_exposed_to_the_user',async()=>{
 vi.stubGlobal('fetch',async()=>apiResponse(null,{output:[{id:'msg_test',type:'message',role:'assistant',status:'completed',content:[{type:'refusal',refusal:'sensitive-provider-message'}]}]}));
 await expect(provider().extractReceipt(image)).rejects.toMatchObject({code:'provider_failed'});
});
it.each([401,429,500])('http_%s_does_not_retry_or_expose_provider_payload',async status=>{
 let calls=0;vi.stubGlobal('fetch',async()=>{calls++;return Response.json({error:{message:'local-test-key sensitive-response'}},{status})});
 await expect(provider().extractReceipt(image)).rejects.toMatchObject({code:'provider_failed',message:expect.not.stringContaining('sensitive')});expect(calls).toBe(1);
});
it('timeout_returns_recoverable_error_and_aborts_http',async()=>{
 vi.useFakeTimers();let aborted=false;
 vi.stubGlobal('fetch',(_url:unknown,options:RequestInit)=>new Promise((_resolve,reject)=>{options.signal!.addEventListener('abort',()=>{aborted=true;reject(new DOMException('Aborted','AbortError'))})}));
 const checked=expect(provider().extractReceipt(image)).rejects.toMatchObject({code:'provider_failed'});
 await vi.advanceTimersByTimeAsync(45_001);await checked;expect(aborted).toBe(true);
});
it('usage_reports_only_numeric_metrics_and_operation',async()=>{
 const reports:AiUsage[]=[];vi.stubGlobal('fetch',async()=>apiResponse({items:[item]}));
 await provider(report=>reports.push(report)).extractReceipt(image);
 expect(reports).toEqual([{operation:'receipt',model:'gpt-6-luna',inputTokens:3000,cachedInputTokens:0,outputTokens:1800,reasoningTokens:1000,totalTokens:4800,durationMs:expect.any(Number)}]);
});
