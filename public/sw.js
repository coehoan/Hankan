/* global importScripts, hankanPushDedup */
importScripts('/push-dedup.js');
const PUBLIC_CACHE='hankan-public-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(PUBLIC_CACHE).then(cache=>cache.addAll(['/offline.html','/icons/icon-192.png','/icons/icon-512.png'])).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('hankan-')&&key!==PUBLIC_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.match('/offline.html')));return}
 // Never cache document responses, APIs, private storage, receipts or recipes.
 if(!(/^\/_next\/static\//.test(url.pathname)||/^\/(icons|fonts)\//.test(url.pathname)||url.pathname==='/offline.html'))return;
 event.respondWith(caches.open(PUBLIC_CACHE).then(async cache=>{const saved=await cache.match(request);if(saved)return saved;const response=await fetch(request);if(response.ok&&response.type==='basic')await cache.put(request,response.clone());return response}));
});
self.addEventListener('message',event=>{
 if(event.data?.type==='BIND_USER')event.waitUntil(hankanPushDedup.bindUser(event.data.userId||null));
 if(event.data?.type==='CLEAR_PRIVATE')event.waitUntil(Promise.all([hankanPushDedup.bindUser(null),caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('hankan-')&&key!==PUBLIC_CACHE).map(key=>caches.delete(key))))]));
});
self.addEventListener('push',event=>{
 event.waitUntil((async()=>{
  let payload;try{payload=event.data?.json()}catch{return}
  if(!payload||typeof payload.notificationId!=='string'||!/^\/notifications\/[0-9a-f-]{36}$/.test(payload.url)||payload.url!=='/notifications/'+payload.digestId)return;
  const user=await hankanPushDedup.currentUser();if(!user||!payload.notificationId.startsWith(user+':'))return;
  if(!await hankanPushDedup.claimNotificationDisplay(payload.notificationId))return;
  await self.registration.showNotification('한칸 · 임박 재료 알림',{body:typeof payload.body==='string'?payload.body.slice(0,120):'먼저 사용할 재료를 확인해 보세요.',icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',tag:payload.notificationId,renotify:false,data:{url:payload.url}});
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const path=event.notification.data?.url;if(typeof path!=='string'||!/^\/notifications\/[0-9a-f-]{36}$/.test(path))return;
 event.waitUntil((async()=>{const url=new URL(path,self.location.origin).href;for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true}))if(new URL(client.url).origin===self.location.origin){await client.navigate(url);return client.focus()}return self.clients.openWindow(url)})());
});
