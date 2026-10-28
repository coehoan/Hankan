import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
function worker(){
 const handlers:Record<string,(event:unknown)=>void>={};const fetch=vi.fn().mockResolvedValue({ok:true,type:'basic'}),open=vi.fn().mockResolvedValue({match:vi.fn().mockResolvedValue(null),put:vi.fn()});
 const context={URL,importScripts:vi.fn(),fetch,caches:{open,match:vi.fn(),keys:vi.fn().mockResolvedValue([])},self:{location:{origin:'https://hankan.test'},addEventListener:(name:string,fn:(event:unknown)=>void)=>{handlers[name]=fn}},hankanPushDedup:{}};
 runInNewContext(readFileSync('public/sw.js','utf8'),context);return {handlers,fetch,open};
}
it('private_pages_and_apis_never_enter_cache',async()=>{const sw=worker();for(const path of ['/api/ingredients','/api/notifications/x','/api/receipts/x','/fridges/x','/recipes/x']){let response:Promise<unknown>|undefined;sw.handlers.fetch({request:{url:'https://hankan.test'+path,method:'GET',mode:'cors'},respondWith:(p:Promise<unknown>)=>{response=p}});expect(response).toBeUndefined()}expect(sw.open).not.toHaveBeenCalled()});
it('navigation_uses_network_without_caching_document',async()=>{const sw=worker();let response:Promise<unknown>|undefined;sw.handlers.fetch({request:{url:'https://hankan.test/fridges/x',method:'GET',mode:'navigate'},respondWith:(p:Promise<unknown>)=>{response=p}});await response;expect(sw.fetch).toHaveBeenCalledOnce();expect(sw.open).not.toHaveBeenCalled()});
