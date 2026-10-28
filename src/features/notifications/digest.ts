import type {Digest,DigestGroup} from './types';
export function buildDigest(userId:string,today:string,groups:DigestGroup[]):Digest|null{
 const end=new Date(today+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+3);const last=end.toISOString().slice(0,10);
 const urgent=groups.map(group=>({...group,ingredients:group.ingredients.filter(i=>i.remainingPercent>0&&i.expiresOn>=today&&i.expiresOn<=last)})).filter(group=>group.ingredients.length>0);
 return urgent.length?{userId,localDate:today,groups:urgent}:null;
}
