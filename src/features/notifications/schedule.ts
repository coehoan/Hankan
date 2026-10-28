import type {ISODate} from '@/features/inventory/contracts';
import {AppError} from '@/lib/errors';
export const localTimePattern=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const invalid=()=>new AppError('validation','알림 시각과 시간대를 확인해 주세요.');
function instant(value:string){const stamp=Date.parse(value);if(!/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(stamp))throw invalid();return stamp}
function formatter(timezone:string){
 if(!/^[A-Za-z][A-Za-z0-9_+\/-]*$/.test(timezone))throw invalid();
 try{return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})}catch{throw invalid()}
}
function partsAt(stamp:number,format:Intl.DateTimeFormat){return Object.fromEntries(format.formatToParts(stamp).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]))}
function datePart(parts:Record<string,string>){return `${parts.year}-${parts.month}-${parts.day}`}
function wallTime(stamp:number,format:Intl.DateTimeFormat){const p=partsAt(stamp,format);return Date.parse(`${datePart(p)}T${p.hour}:${p.minute}:${p.second}Z`)}
function nextDay(date:string){return new Date(Date.parse(date+'T00:00:00Z')+86_400_000).toISOString().slice(0,10)}
function scheduledInstant(date:string,localTime:string,format:Intl.DateTimeFormat){
 const wall=Date.parse(`${date}T${localTime}:00Z`);
 // Sample both sides of a zone transition. Resolve a repeated time to its later
 // occurrence, and a skipped time forwards, matching PostgreSQL AT TIME ZONE.
 const offsets=new Set([-36,0,36].map(hours=>{const sample=wall+hours*3_600_000;return wallTime(sample,format)-sample}));
 const candidates=Array.from(offsets,offset=>wall-offset),exact=candidates.filter(stamp=>wallTime(stamp,format)===wall);
 return Math.max(...(exact.length?exact:candidates));
}
export function localDateAt(now:string,timezone:string):ISODate{return datePart(partsAt(instant(now),formatter(timezone)))}
export function nextNotificationAt({now,timezone,localTime,lastSentLocalDate}:{now:string;timezone:string;localTime:string;lastSentLocalDate:ISODate|null}):string{
 if(!localTimePattern.test(localTime))throw invalid();
 const current=instant(now),format=formatter(timezone),today=datePart(partsAt(current,format));let day=today;
 if(lastSentLocalDate!==null){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(lastSentLocalDate)||!Number.isFinite(Date.parse(lastSentLocalDate+'T00:00:00Z'))||new Date(lastSentLocalDate+'T00:00:00Z').toISOString().slice(0,10)!==lastSentLocalDate)throw invalid();
  if(lastSentLocalDate>=today)day=nextDay(lastSentLocalDate);
 }
 let next=scheduledInstant(day,localTime,format);if(next<=current)next=scheduledInstant(nextDay(day),localTime,format);
 return new Date(next).toISOString().replace('.000Z','Z');
}
