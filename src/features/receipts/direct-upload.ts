import 'server-only';
import {randomUUID} from 'node:crypto';
import {requireFridgeAccess} from '@/lib/auth';
import {AppError} from '@/lib/errors';
import {createAdminSupabaseClient} from '@/lib/supabase/admin';
import {browserSupabaseUrl} from '@/lib/supabase/server-config';
import {parseId} from '@/features/inventory/domain';
import {MAX_IMAGE_BYTES,verifyReceiptImage} from './image';
import {createReceiptDraft} from './service';
const bucket='receipt-uploads';
export async function prepareReceiptUpload(fridgeId:string,mime:string,size:number):Promise<{objectPath:string;uploadUrl:string}>{
 if(!Number.isInteger(size)||size<1||size>MAX_IMAGE_BYTES||!['image/png','image/jpeg','image/webp'].includes(mime))throw new AppError('validation','JPEG·PNG·WebP 사진을 10MB 이하로 올려 주세요.');
 const access=await requireFridgeAccess(parseId(fridgeId)),objectPath=access.userId+'_'+access.fridgeId+'_'+randomUUID();
 const {data,error}=await createAdminSupabaseClient().storage.from(bucket).createSignedUploadUrl(objectPath,{upsert:false});
 if(error||!data)throw new AppError('internal','사진 업로드를 준비하지 못했어요. 다시 시도해 주세요.');
 return {objectPath,uploadUrl:browserSupabaseUrl(data.signedUrl)};
}
export async function completeReceiptUpload(fridgeId:string,objectPath:string):Promise<{draftId:string}>{
 const access=await requireFridgeAccess(parseId(fridgeId)),prefix=access.userId+'_'+access.fridgeId+'_';
 if(typeof objectPath!=='string'||!objectPath.startsWith(prefix)||!/^[-0-9a-f]{36}$/.test(objectPath.slice(prefix.length)))throw new AppError('forbidden','접근할 수 없는 업로드예요.');
 parseId(objectPath.slice(prefix.length));
 const {data,error}=await createAdminSupabaseClient().storage.from(bucket).download(objectPath);
 if(error||!data||data.size>MAX_IMAGE_BYTES)throw new AppError('validation','사진 업로드가 완료되지 않았어요. 다시 올려 주세요.');
 const verified=await verifyReceiptImage(new Uint8Array(await data.arrayBuffer()),data.type);
 return createReceiptDraft(access,verified);
}
