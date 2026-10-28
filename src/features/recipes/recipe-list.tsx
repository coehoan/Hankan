'use client';
import {useEffect,useState} from 'react';
import {useInventory} from '@/features/inventory/use-inventory';
import {RecipeResults} from './recipe-results';
export function RecipeList({fridgeId,fridgeName,initialToday,timeZone='Asia/Seoul',onAccessLost}:{fridgeId:string;fridgeName:string;initialToday:string;timeZone?:string;onAccessLost?:()=>void}){
 const inventory=useInventory(fridgeId),[today,setToday]=useState(initialToday);
 useEffect(()=>{const timer=setInterval(()=>{const parts=new Intl.DateTimeFormat('en',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts();setToday(['year','month','day'].map(type=>parts.find(part=>part.type===type)!.value).join('-'))},30_000);return()=>clearInterval(timer)},[timeZone]);
 useEffect(()=>{if(inventory.revoked)onAccessLost?.()},[inventory.revoked,onAccessLost]);
 return <main className="recipes-page"><header className="recipes-page-heading"><p className="eyebrow">LESS WASTE, MORE GOOD FOOD</p><h1>오늘은 뭘 먹을까요?</h1><p><strong>{fridgeName}</strong>의 재료로 찾아요. 기한이 가까운 재료를 먼저 활용해 보세요.</p></header><RecipeResults fridgeId={fridgeId} ingredients={inventory.items} today={today} online={inventory.online} loading={inventory.loading} revoked={inventory.revoked} pending={inventory.pendingId!==null} inventoryError={!!inventory.error} onAccessLost={onAccessLost}/></main>;
}
