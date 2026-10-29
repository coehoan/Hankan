'use client';
import { useEffect,useRef,useState } from 'react';
import type { Ingredient,StoragePlace } from './contracts';
import { sortIngredients,urgencyOf } from './domain';
import { useInventory } from './use-inventory';
import { IngredientForm } from './ingredient-form';
import {IngredientArt} from './ingredient-art';
import Link from 'next/link';
import {RecipeResults} from '@/features/recipes/recipe-results';
import {Dialog} from '@/components/ui/dialog';

const storageNames:Record<StoragePlace,string>={fridge:'냉장',freezer:'냉동',pantry:'실온'};
function daysLeft(date:string,today:string){return Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000)}
function dateInZone(zone:string){const parts=new Intl.DateTimeFormat('en',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts();return ['year','month','day'].map(type=>parts.find(part=>part.type===type)!.value).join('-')}

function IngredientRow({item,today,disabled,saving,onEdit,onUpdate,onDelete}:{item:Ingredient;today:string;disabled:boolean;saving:boolean;onEdit:()=>void;onUpdate:(value:number)=>Promise<void>;onDelete:()=>void}){
 const [draft,setDraft]=useState<{version:number;value:number}|null>(null),inFlight=useRef(false);
 const value=draft?.version===item.version?draft.value:item.remainingPercent;
 const left=daysLeft(item.expiresOn,today),urgency=urgencyOf(item.expiresOn,today);
 async function commit(){if(inFlight.current||disabled)return;const next=value;if(next===item.remainingPercent){setDraft(null);return}inFlight.current=true;try{await onUpdate(next)}catch{/* The screen displays the request failure and retry. */}finally{inFlight.current=false;setDraft(null)}}
 return <article className="ingredient-row"><button className="ingredient-main" aria-label={item.name+' 수정'} onClick={onEdit} disabled={disabled}><span className="ingredient-symbol" aria-hidden="true"><IngredientArt name={item.name}/></span><span className="ingredient-copy"><span className="ingredient-name">{item.name}<span className={'expiry-badge '+urgency}>{left<0?`${-left}일 지남`:left===0?'오늘까지':`${left}일 남음`}</span></span><span className="ingredient-meta">{storageNames[item.storage]}<span aria-hidden="true">·</span><time dateTime={item.expiresOn}>{item.expiresOn.replaceAll('-','.')}까지</time></span></span></button>
  <div className="ingredient-quantity"><div className="quantity-caption"><span>{saving?'저장 중…':'남은 양'}</span><output>{value}%</output></div><input aria-label={item.name+' 남은 양'} type="range" min={0} max={100} step={5} value={value} disabled={disabled} onChange={event=>setDraft({version:item.version,value:Number(event.target.value)})} onPointerUp={()=>void commit()} onBlur={()=>void commit()} onKeyUp={event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))void commit()}}/><button className="delete-ingredient" aria-label={item.name+' 삭제'} onClick={onDelete} disabled={disabled}>다 먹었어요 · 삭제</button></div>
 </article>;
}

type Editor={fridgeId:string;item?:Ingredient};
export function InventoryScreen({fridgeId,fridgeName,initialToday,timeZone='Asia/Seoul',onAccessLost,onReceiptUpload}:{fridgeId:string;fridgeName:string;initialToday:string;timeZone?:string;onAccessLost?:()=>void;onReceiptUpload?:()=>void}){
 const inventory=useInventory(fridgeId);
 const [query,setQuery]=useState(''),[filter,setFilter]=useState<StoragePlace|'all'>('all'),[editor,setEditor]=useState<Editor|null>(null),[notice,setNotice]=useState(''),[today,setToday]=useState(initialToday);
 const [addingFor,setAddingFor]=useState<string|null>(null);
 useEffect(()=>{const timer=setInterval(()=>setToday(dateInZone(timeZone)),30_000);return()=>clearInterval(timer)},[timeZone]);
 useEffect(()=>{if(inventory.revoked)onAccessLost?.()},[inventory.revoked,onAccessLost]);
 const activeEditor=editor?.fridgeId===fridgeId?editor:null;
 const sorted=sortIngredients(inventory.items,today);
 const visible=sorted.filter(item=>(filter==='all'||item.storage===filter)&&item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 const groups=[{key:'expired' as const,label:'기한 지남',sub:'상태를 확인해 주세요'},{key:'soon' as const,label:'먼저 먹어요',sub:'기한이 가까운 순'},{key:'normal' as const,label:'조금 더 여유 있어요',sub:'신선함을 오래오래'}];
 const busy=inventory.pendingId!==null,disabled=busy||!inventory.online;
 const expired=sorted.filter(item=>urgencyOf(item.expiresOn,today)==='expired').length;
 const soon=sorted.filter(item=>urgencyOf(item.expiresOn,today)==='soon');
 if(inventory.revoked)return <section className="inventory-message" role="alert"><h1>냉장고 접근 권한이 변경됐어요</h1><p>접근 가능한 내 냉장고로 이동합니다.</p></section>;
 return <main className="inventory-page"><div className="inventory-intro"><div><h1>{fridgeName}<span>{inventory.items.length}개</span></h1><p className="inventory-subtitle">잊고 있던 재료도, 맛있는 한 끼가 될 수 있어요.</p></div><button className="add-button" aria-label="재료 등록" onClick={()=>{setAddingFor(fridgeId);setNotice('')}} disabled={disabled}><span aria-hidden="true">＋</span> <span>재료 등록</span></button></div>
 {addingFor===fridgeId&&<Dialog open title="재료 등록 방법" onOpenChange={open=>{if(!open)setAddingFor(null)}}><p className="muted">재료를 어떻게 등록할까요?</p><div className="registration-methods"><button className="settings-row" disabled={disabled} onClick={()=>{setAddingFor(null);setEditor({fridgeId})}}><span>직접 입력</span><span aria-hidden="true">›</span></button><button className="settings-row" disabled={disabled||!onReceiptUpload} onClick={()=>{setAddingFor(null);onReceiptUpload?.()}}><span>영수증 등록</span><span aria-hidden="true">›</span></button></div></Dialog>}
 {!inventory.online&&<p className="connection-banner" role="status">오프라인이에요. 연결이 돌아오면 최신 목록을 확인하고 저장할 수 있어요.</p>}
 {activeEditor&&<IngredientForm key={`${fridgeId}:${activeEditor.item?.id??'new'}:${activeEditor.item?.version??0}`} item={activeEditor.item} latestItem={inventory.items.find(item=>item.id===activeEditor.item?.id)} online={inventory.online} create={inventory.create} update={inventory.update} onCancel={()=>setEditor(null)} onComplete={()=>{setEditor(current=>current?.fridgeId===fridgeId?null:current);setNotice('재료를 저장했어요.')}} onReload={()=>{const latest=inventory.items.find(item=>item.id===activeEditor.item?.id);if(latest)setEditor({fridgeId,item:latest})}}/>}
 <div className="inventory-columns"><div className="inventory-list-column"><div className="inventory-tools"><div className="storage-filters" role="group" aria-label="보관 장소 필터">{(['all','fridge','freezer','pantry'] as const).map(place=><button key={place} aria-pressed={filter===place} onClick={()=>setFilter(place)}>{place==='all'?'전체':storageNames[place]}</button>)}</div><label className="inventory-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="재료 이름 검색" placeholder="재료 이름 검색" value={query} onChange={event=>setQuery(event.target.value)}/></label></div>
 {inventory.error&&!activeEditor&&<div className="inventory-error"><p role="alert">{inventory.error.message}</p><button className="text-button" onClick={()=>void inventory.refresh()} disabled={!inventory.online||busy}>다시 불러오기</button></div>}
 {notice&&<p className="inventory-notice" role="status">{notice}</p>}
 {inventory.loading?<div className="inventory-loading" role="status">냉장고를 살펴보고 있어요…<span/><span/><span/></div>:inventory.error&&inventory.items.length===0?<section className="empty-inventory"><h2>목록을 확인하지 못했어요</h2><p>연결을 확인한 뒤 다시 불러와 주세요. 저장된 재료는 그대로 남아 있어요.</p></section>:visible.length===0?<section className="empty-inventory"><span className="empty-leaf" aria-hidden="true">✳</span><h2>{inventory.items.length?'찾는 재료가 없어요':'냉장고의 첫 재료를 담아 보세요'}</h2><p>{inventory.items.length?'이름이나 보관 장소를 바꿔서 찾아보세요.':'이름과 유통기한을 적어두면 무엇을 먼저 먹을지 한눈에 보여요.'}</p>{inventory.items.length?<button className="secondary-button" onClick={()=>{setFilter('all');setQuery('')}}>필터 초기화</button>:<button className="secondary-button" onClick={()=>setAddingFor(fridgeId)} disabled={disabled}>첫 재료 등록</button>}</section>:groups.map(group=>{
  const rows=visible.filter(item=>urgencyOf(item.expiresOn,today)===group.key);return rows.length>0&&<section key={group.key} className={'ingredient-group '+group.key} aria-labelledby={'group-'+group.key}><header><h2 id={'group-'+group.key}>{group.label}<span>· {rows.length}개</span></h2><p>{group.sub}</p></header>{rows.map(item=><IngredientRow key={item.id} item={item} today={today} disabled={disabled} saving={inventory.pendingId===item.id} onEdit={()=>{setEditor({fridgeId,item});setNotice('')}} onUpdate={async value=>{await inventory.update(item.id,item.version,{remainingPercent:value});setNotice('남은 양을 저장했어요.')}} onDelete={()=>{setNotice('');void inventory.remove(item.id,item.version).then(()=>setNotice('재료를 삭제했어요.')).catch(()=>{})}}/>)}</section>;
 })}
 <div className="inventory-bottom"><span>{busy?'변경 내용을 저장하고 있어요.':'함께 관리하는 목록도 최신 상태로 확인해요.'}</span><button className="text-button" onClick={()=>void inventory.refresh()} disabled={!inventory.online||busy}>새로고침</button></div></div>
 <aside className="fridge-summary" aria-label="냉장고 요약"><div className="summary-heading"><span aria-hidden="true">✳</span><p>조금 더 신선한<br/><strong>오늘의 냉장고</strong></p></div><dl><div><dt>보관 중인 재료</dt><dd>{inventory.items.length}<small>개</small></dd></div><div><dt>기한이 3일 이내</dt><dd>{soon.length}<small>개</small></dd></div><div><dt>기한이 지난 재료</dt><dd>{expired}<small>개</small></dd></div></dl><div className="summary-recipes"><RecipeResults compact fridgeId={fridgeId} ingredients={inventory.items} today={today} online={inventory.online} loading={inventory.loading} revoked={inventory.revoked} pending={busy} inventoryError={!!inventory.error} onAccessLost={onAccessLost}/><Link className="text-button" href={'/fridges/'+fridgeId+'/recipes'}>요리 추천 전체 보기</Link></div><p className="summary-date">{today.replaceAll('-','.')} 기준</p></aside>
 </div></main>;
}
