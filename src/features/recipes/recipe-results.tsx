'use client';
import {useEffect,useId,useMemo,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import type {Ingredient} from '@/features/inventory/contracts';
import {inventoryVersion,usableIngredients,type RecipeMatch} from './domain';
import {RecipeDetail} from './recipe-detail';
type Props={fridgeId:string;ingredients:Ingredient[];today:string;online:boolean;loading:boolean;revoked:boolean;pending?:boolean;inventoryError?:boolean;compact?:boolean;onAccessLost?:()=>void};
type Context={fridgeId:string;version:string;today:string;online:boolean;loading:boolean;revoked:boolean;pending:boolean;inventoryError:boolean};
type ResultState={context:Context;phase:'idle'|'loading'|'ready'|'error';matches:RecipeMatch[];error:string;selectedId:string|null};
type Scope={context:Context;active:boolean;sequence:number;controller:AbortController|null;busy:boolean};
export function RecipeResults({fridgeId,ingredients,today,online,loading,revoked,pending=false,inventoryError=false,compact=false,onAccessLost}:Props){
 const version=inventoryVersion(ingredients),headingId=useId();
 const context=useMemo(()=>({fridgeId,version,today,online,loading,revoked,pending,inventoryError}),[fridgeId,version,today,online,loading,revoked,pending,inventoryError]);
 const [state,setState]=useState<ResultState>(()=>({context,phase:'idle',matches:[],error:'',selectedId:null}));
 const scopeRef=useRef<Scope|null>(null);
 useEffect(()=>{const scope:Scope={context,active:true,sequence:0,controller:null,busy:false};scopeRef.current=scope;return()=>{scope.active=false;scope.sequence++;scope.controller?.abort()}},[context]);
 const current=state.context===context;
 const phase=current?state.phase:'idle',matches=current?state.matches:[],selected=matches.find(item=>item.recipe.id===state.selectedId);
 const stale=!current&&state.context.fridgeId===fridgeId&&state.phase!=='idle';
 const usable=usableIngredients(ingredients,today),disabled=loading||revoked||pending||inventoryError||!online||phase==='loading'||!usable.length;
 async function recommend(){
  const scope=scopeRef.current;if(disabled||!scope||!scope.active||scope.context!==context||scope.busy||navigator.onLine===false)return;
  scope.busy=true;scope.controller?.abort();const controller=new AbortController();scope.controller=controller;const sequence=++scope.sequence;
  setState({context,phase:'loading',matches:[],error:'',selectedId:null});
  try{
   const response=await fetch('/api/fridges/'+encodeURIComponent(fridgeId)+'/recipes',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store',signal:controller.signal});
   const json=await response.json();if(!scope.active||scope.sequence!==sequence)return;
   if(!response.ok){if([401,403].includes(response.status))onAccessLost?.();throw new Error(json.error?.message??'요리 추천을 불러오지 못했어요. 다시 시도해 주세요.')}
   if(!Array.isArray(json.data)||json.inventoryVersion!==context.version||json.today!==context.today)throw new Error('재료나 날짜가 바뀌었어요. 최신 목록으로 다시 추천해 주세요.');
   setState({context,phase:'ready',matches:json.data,error:'',selectedId:null});
  }catch(caught){if(scope.active&&scope.sequence===sequence&&!controller.signal.aborted)setState({context,phase:'error',matches:[],error:caught instanceof Error?caught.message:'연결을 확인하고 다시 시도해 주세요.',selectedId:null})}
  finally{scope.busy=false;if(scope.controller===controller)scope.controller=null}
 }
 if(revoked)return <p className="recipe-feedback" role="alert">냉장고 접근 권한이 변경되어 추천을 지웠어요.</p>;
 return <section className={compact?'recipe-results compact':'recipe-results'} aria-label="재료로 찾는 요리"><header className="recipe-results-intro"><div><h2>남은 재료로, 오늘 한 끼</h2></div><Button disabled={disabled} onClick={()=>void recommend()}>{phase==='loading'?'추천 찾는 중…':phase==='idle'?'요리 추천 받기':'다시 추천 받기'}</Button></header>
 <p className="recipe-quantity-note">재료 종류를 기준으로 찾아요. 조리법의 필요한 양은 따로 확인해 주세요.</p>
 {!online&&<p className="connection-banner" role="status">온라인으로 연결하면 요리를 추천받을 수 있어요.</p>}
 {loading?<p className="recipe-feedback" role="status">현재 냉장고 재료를 확인하고 있어요…</p>:inventoryError?<p className="recipe-feedback" role="status">재료 목록을 다시 불러온 뒤 추천받아 주세요.</p>:!usable.length&&<div className="recipe-empty"><h3>추천에 쓸 재료가 아직 없어요</h3><p>남은 양이 있는 재료를 등록해 주세요. 0%이거나 기한이 지난 묶음은 추천에서 제외해요.</p></div>}
 {stale&&<p className="recipe-feedback" role="status">재료나 연결 상태가 바뀌어 이전 추천을 지웠어요. 다시 추천받아 주세요.</p>}
 {phase==='loading'&&<div className="recipe-loading" role="status">현재 재료로 만들 요리를 찾고 있어요…</div>}
 {phase==='error'&&<div className="recipe-error"><p role="alert">{state.error}</p><p>보관 중인 재료와 남은 양은 바뀌지 않았어요.</p></div>}
 {phase==='ready'&&matches.length===0&&<div className="recipe-empty"><h3>겹치는 재료의 요리를 찾지 못했어요</h3><p>재료를 더 등록하거나 잠시 후 다시 추천받아 보세요.</p></div>}
 {phase==='ready'&&(['available','needs-shopping'] as const).map(kind=>{const group=matches.filter(item=>item.kind===kind);return <section className="recipe-group" key={kind} aria-labelledby={headingId+kind}><header><h3 id={headingId+kind}>{kind==='available'?'보유 재료로 만들어요':'조금만 더 사면 만들어요'}<span>{group.length}개</span></h3></header>{group.length===0?<p className="recipe-group-empty">이 분류의 추천은 아직 없어요.</p>:<div className="recipe-cards">{(compact?group.slice(0,2):group).map(item=><article className="recipe-card" key={item.recipe.id}>{item.urgentIngredientIds.length>0&&<p className="recipe-urgency">임박 재료 {item.urgentIngredientIds.length}종 활용</p>}<h4>{item.recipe.name}</h4><p className="recipe-card-meta">약 {item.recipe.prepMinutes}분 · {item.recipe.servings}인분</p>{item.missing.length>0&&<p className="recipe-missing">추가할 재료: {item.missing.join(', ')}</p>}<Button variant="secondary" onClick={()=>setState(previous=>({...previous,selectedId:item.recipe.id}))} aria-label={item.recipe.name+' 조리법 보기'}>재료·조리법 보기 <span aria-hidden="true">↗</span></Button></article>)}</div>}</section>})}
 {current&&selected&&<RecipeDetail match={selected} ingredients={ingredients} onClose={()=>setState(previous=>({...previous,selectedId:null}))}/>}
 </section>;
}
