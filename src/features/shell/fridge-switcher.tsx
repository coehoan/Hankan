'use client';
import type { FridgeSummary } from './contracts';
export type { FridgeSummary } from './contracts';
export function FridgeSwitcher({fridges,selectedId,onSelect,disabled=false}:{fridges:FridgeSummary[];selectedId:string;onSelect:(id:string)=>void;disabled?:boolean}){
 return <label className="fridge-switcher"><span>지금 보고 있는 냉장고</span><select aria-label="냉장고 선택" value={selectedId} onChange={event=>onSelect(event.target.value)} disabled={disabled}>{fridges.map(fridge=><option key={fridge.id} value={fridge.id}>{fridge.name} · {fridge.role==='owner'?'내 소유':'함께 사용'}</option>)}</select></label>;
}
