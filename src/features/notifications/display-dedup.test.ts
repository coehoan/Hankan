import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {IDBFactory} from 'fake-indexeddb';
function store(){const scope={indexedDB:new IDBFactory(),hankanPushDedup:null as unknown as {claimNotificationDisplay(id:string):Promise<boolean>;bindUser(id:string|null):Promise<void>;currentUser():Promise<string|null>}};runInNewContext(readFileSync('public/push-dedup.js','utf8'),scope);return scope.hankanPushDedup}
it('send_retry_displays_same_digest_only_once',async()=>{const db=store();expect(await Promise.all([db.claimNotificationDisplay('user:2026-10-28'),db.claimNotificationDisplay('user:2026-10-28')])).toEqual([true,false]);expect(await db.claimNotificationDisplay('user:2026-10-29')).toBe(true)});
it('logout_clears_current_identity_without_erasing_display_history',async()=>{const db=store();await db.bindUser('owner');expect(await db.currentUser()).toBe('owner');await db.claimNotificationDisplay('owner:day');await db.bindUser(null);expect(await db.currentUser()).toBeNull();await db.bindUser('another');expect(await db.claimNotificationDisplay('owner:day')).toBe(false)});
