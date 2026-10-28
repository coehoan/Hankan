import {readDigest} from '@/features/notifications/read-digest';
import {inventoryResponse} from '@/features/inventory/http';
import {errorResponse} from '@/lib/errors';
export async function GET(_request:Request,{params}:{params:Promise<{digestId:string}>}){try{return inventoryResponse(await readDigest((await params).digestId))}catch(error){return errorResponse(error)}}
