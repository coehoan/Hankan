(function(scope){
 'use strict';
 function open(){return new Promise(function(resolve,reject){var request=scope.indexedDB.open('hankan-push',1);request.onupgradeneeded=function(){request.result.createObjectStore('displayed');request.result.createObjectStore('identity')};request.onsuccess=function(){resolve(request.result)};request.onerror=function(){reject(new Error('Push display storage unavailable'))}})}
 async function claimNotificationDisplay(id){
  var db=await open();return new Promise(function(resolve,reject){var tx=db.transaction('displayed','readwrite'),added=true;var request=tx.objectStore('displayed').add(Date.now(),id);
   request.onerror=function(event){if(request.error.name==='ConstraintError'){added=false;event.preventDefault();event.stopPropagation()}};
   tx.oncomplete=function(){db.close();resolve(added)};tx.onabort=function(){db.close();reject(new Error('Push display claim failed'))};
  });
 }
 async function bindUser(id){var db=await open();return new Promise(function(resolve,reject){var tx=db.transaction('identity','readwrite');if(id)tx.objectStore('identity').put(id,'current');else tx.objectStore('identity').delete('current');tx.oncomplete=function(){db.close();resolve()};tx.onabort=function(){db.close();reject(new Error('Push identity unavailable'))}})}
 async function currentUser(){var db=await open();return new Promise(function(resolve,reject){var tx=db.transaction('identity','readonly'),request=tx.objectStore('identity').get('current');tx.oncomplete=function(){db.close();resolve(request.result||null)};tx.onabort=function(){db.close();reject(new Error('Push identity unavailable'))}})}
 scope.hankanPushDedup={claimNotificationDisplay:claimNotificationDisplay,bindUser:bindUser,currentUser:currentUser};
})(globalThis);
