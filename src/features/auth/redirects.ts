export function safeNextPath(value:string|null|undefined):string{
 if(!value||value.length>2048)return '/';
 let decoded=value;
 for(let i=0;i<3;i++){
  if(!decoded.startsWith('/')||decoded.startsWith('//')||decoded.includes('\\')||Array.from(decoded).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127))return '/';
  try{
   if(new URL(decoded,'https://hankan.invalid').origin!=='https://hankan.invalid')return '/';
   const next=decodeURIComponent(decoded);
   if(next===decoded)return value;
   decoded=next;
  }catch{return '/'}
 }
 return '/';
}
