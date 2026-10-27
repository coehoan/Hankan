'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import type { CreateIngredientInput,Ingredient,IngredientPatch } from './contracts';

type Failure={code:string;message:string};
type Snapshot={fridgeId:string;items:Ingredient[];loading:boolean;readError:Failure|null;mutationError:Failure|null;online:boolean;revoked:boolean;pendingId:string|null};
type Scope={fridgeId:string;active:boolean;revoked:boolean;busy:boolean;sequence:number;read:AbortController|null;writes:Set<AbortController>};
const blank=(fridgeId:string):Snapshot=>({fridgeId,items:[],loading:true,readError:null,mutationError:null,online:true,revoked:false,pendingId:null});
export class InventoryRequestError extends Error {
 constructor(readonly code:string,message:string){super(message);this.name='InventoryRequestError'}
}
const failure=(error:unknown):Failure=>error instanceof InventoryRequestError?{code:error.code,message:error.message}:{code:'connection',message:'연결을 확인하고 다시 시도해 주세요.'};
const foreground=()=>document.visibilityState!=='hidden'&&navigator.onLine!==false;
async function readResponse<T>(response:Response):Promise<T>{
 const json=await response.json();
 if(!response.ok)throw new InventoryRequestError(response.status===401?'unauthenticated':response.status===403?'forbidden':json.error?.code??'internal',json.error?.message??'요청을 완료하지 못했어요. 다시 시도해 주세요.');
 if(!Object.hasOwn(json,'data'))throw new InventoryRequestError('internal','응답을 확인하지 못했어요. 다시 시도해 주세요.');
 return json.data as T;
}

export function useInventory(fridgeId:string){
 const [snapshot,setSnapshot]=useState<Snapshot>(()=>blank(fridgeId));
 const stateRef=useRef(snapshot),scopeRef=useRef<Scope|null>(null);
 const current=useCallback((scope:Scope)=>scopeRef.current===scope&&scope.active,[]);
 const publish=useCallback((scope:Scope,patch:Partial<Snapshot>)=>{
  if(!current(scope))return;
  stateRef.current={...stateRef.current,...patch,fridgeId:scope.fridgeId};setSnapshot(stateRef.current);
 },[current]);
 const revoke=useCallback((scope:Scope,error:Failure)=>{
  scope.revoked=true;scope.sequence++;scope.read?.abort();
  publish(scope,{items:[],loading:false,revoked:true,pendingId:null,readError:error,mutationError:null});
 },[publish]);
 const load=useCallback(async(scope:Scope,force=false)=>{
  if(!current(scope)||scope.revoked||scope.busy||!foreground()||(scope.read&&!force))return;
  scope.read?.abort();const controller=new AbortController();scope.read=controller;
  const request=++scope.sequence;
  try{
   const response=await fetch(`/api/fridges/${encodeURIComponent(scope.fridgeId)}/ingredients`,{cache:'no-store',credentials:'same-origin',signal:controller.signal});
   const rows=await readResponse<Ingredient[]>(response);
   if(current(scope)&&request===scope.sequence)publish(scope,{items:rows,loading:false,readError:null});
  }catch(error){
   if(!current(scope)||request!==scope.sequence||controller.signal.aborted)return;
   const problem=failure(error);
   if(problem.code==='forbidden'||problem.code==='unauthenticated')revoke(scope,problem);
   else publish(scope,{loading:false,readError:problem});
  }finally{if(scope.read===controller)scope.read=null}
 },[current,publish,revoke]);
 useEffect(()=>{
  const scope:Scope={fridgeId,active:true,revoked:false,busy:false,sequence:0,read:null,writes:new Set()};
  scopeRef.current=scope;publish(scope,{...blank(fridgeId),online:navigator.onLine!==false});void load(scope);
  const resume=()=>{publish(scope,{online:navigator.onLine!==false});if(foreground())void load(scope)};
  const pause=()=>{scope.sequence++;scope.read?.abort();scope.read=null;publish(scope,{online:navigator.onLine!==false,loading:false})};
  const visibility=()=>{if(document.visibilityState==='hidden')pause();else resume()};
  const timer=setInterval(()=>{void load(scope)},3000);
  window.addEventListener('focus',resume);window.addEventListener('online',resume);window.addEventListener('offline',pause);document.addEventListener('visibilitychange',visibility);
  return()=>{scope.active=false;scope.sequence++;scope.read?.abort();for(const controller of scope.writes)controller.abort();clearInterval(timer);window.removeEventListener('focus',resume);window.removeEventListener('online',resume);window.removeEventListener('offline',pause);document.removeEventListener('visibilitychange',visibility)};
 },[fridgeId,load,publish]);
 const refresh=useCallback(async()=>{const scope=scopeRef.current;if(!scope||scope.fridgeId!==fridgeId)return;publish(scope,{mutationError:null});await load(scope,true)},[fridgeId,load,publish]);
 const mutate=useCallback(async<T,>(method:'POST'|'PATCH'|'DELETE',id:string|null,body:unknown,optimistic?:(items:Ingredient[])=>Ingredient[]):Promise<T>=>{
  const scope=scopeRef.current;
  if(!scope||!current(scope)||scope.fridgeId!==fridgeId||scope.revoked)throw new InventoryRequestError('forbidden','냉장고 접근 권한을 다시 확인해 주세요.');
  if(navigator.onLine===false)throw new InventoryRequestError('offline','온라인으로 연결한 뒤 다시 시도해 주세요.');
  if(scope.busy)throw new InventoryRequestError('pending','저장 중이에요. 잠시만 기다려 주세요.');
  scope.busy=true;scope.sequence++;scope.read?.abort();scope.read=null;
  const previous=stateRef.current.items;
  publish(scope,{items:optimistic?optimistic(previous):previous,pendingId:id??'create',mutationError:null});
  const controller=new AbortController();scope.writes.add(controller);
  try{
   const url=`/api/fridges/${encodeURIComponent(fridgeId)}/ingredients`+(id?`/${encodeURIComponent(id)}`:'');
   const response=await fetch(url,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
   const value=await readResponse<T>(response);
   if(current(scope)&&!scope.revoked&&method!=='DELETE'){
    const saved=value as Ingredient,rows=stateRef.current.items;
    publish(scope,{items:rows.some(row=>row.id===saved.id)?rows.map(row=>row.id===saved.id?saved:row):[...rows,saved]});
   }
   return value;
  }catch(error){
   if(current(scope)){const problem=failure(error);if(problem.code==='forbidden'||problem.code==='unauthenticated')revoke(scope,problem);else publish(scope,{items:previous,mutationError:problem})}
   throw error;
  }finally{scope.writes.delete(controller);scope.busy=false;if(current(scope)){publish(scope,{pendingId:null});await load(scope)}}
 },[current,fridgeId,load,publish,revoke]);
 const create=useCallback((input:CreateIngredientInput)=>mutate<Ingredient>('POST',null,input),[mutate]);
 const update=useCallback((id:string,version:number,patch:IngredientPatch)=>mutate<Ingredient>('PATCH',id,{expectedVersion:version,patch},rows=>rows.map(row=>row.id===id?{...row,...patch}:row)),[mutate]);
 const remove=useCallback(async(id:string,version:number)=>{await mutate<null>('DELETE',id,{expectedVersion:version},rows=>rows.filter(row=>row.id!==id))},[mutate]);
 const visible=snapshot.fridgeId===fridgeId?snapshot:blank(fridgeId);
 return {items:visible.items,loading:visible.loading,error:visible.mutationError??visible.readError,online:visible.online,revoked:visible.revoked,pendingId:visible.pendingId,refresh,create,update,remove};
}
