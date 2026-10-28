import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {seedTestGroup,cleanupTestGroup,localAdmin,type GroupFixture} from '../support/db';
import {cleanupReceiptFiles} from '../../src/jobs/worker';
let group:GroupFixture,path:string;
beforeAll(async()=>{group=await seedTestGroup()});afterAll(async()=>{if(path)await localAdmin().storage.from('receipt-originals').remove([path]);if(group)await cleanupTestGroup(group)});
it('expired_photo_is_deleted_and_cleanup_marker_is_cleared_idempotently',async()=>{
 const id=randomUUID(),admin=localAdmin();const created=await group.owner.client.rpc('create_receipt_draft',{draft_id:id,target_fridge_id:group.fridgeId});expect(created.error).toBeNull();path=created.data!.object_path;
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=','base64');
 const uploaded=await admin.storage.from('receipt-originals').upload(path,png,{contentType:'image/png'});expect(uploaded.error).toBeNull();
 expect((await admin.from('receipt_drafts').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('id',id)).error).toBeNull();
 expect((await cleanupReceiptFiles(new Date().toISOString())).deleted).toBeGreaterThanOrEqual(1);
 const row=await admin.from('receipt_drafts').select('cleanup_pending,status').eq('id',id).single();expect(row.data).toMatchObject({cleanup_pending:false,status:'cancelled'});
 expect((await admin.storage.from('receipt-originals').download(path)).error).not.toBeNull();
 expect((await cleanupReceiptFiles(new Date().toISOString())).failed).toBe(0);
});
