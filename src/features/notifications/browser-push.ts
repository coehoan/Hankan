'use client';
export function supportsPush(){return typeof window!=='undefined'&&window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window}
export async function registerWorker(){return navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'})}
export async function clearBrowserPush(){
 if(!('serviceWorker' in navigator))return;
 const registration=await navigator.serviceWorker.getRegistration('/');
 (registration?.active??navigator.serviceWorker.controller)?.postMessage({type:'CLEAR_PRIVATE'});
 await (await registration?.pushManager.getSubscription())?.unsubscribe();
}
export async function bindPushIdentity(registration:ServiceWorkerRegistration,userId:string,signal?:AbortSignal){
 const worker=registration.active??registration.waiting??registration.installing;
 if(!worker)return;
 if(worker.state!=='activated')await new Promise<void>((resolve,reject)=>{
  const done=()=>{worker.removeEventListener('statechange',change);signal?.removeEventListener('abort',abort)};
  const change=()=>{if(worker.state==='activated'){done();resolve()}else if(worker.state==='redundant'){done();reject(new Error('알림 연결을 다시 시도해 주세요.'))}};
  const abort=()=>{done();reject(new DOMException('Aborted','AbortError'))};
  worker.addEventListener('statechange',change);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 });
 signal?.throwIfAborted();worker.postMessage({type:'BIND_USER',userId});
}
