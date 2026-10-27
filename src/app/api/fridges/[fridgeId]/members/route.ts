import {requireFridgeAccess} from '@/lib/auth';
import {errorResponse} from '@/lib/errors';
import {parseId} from '@/features/inventory/domain';
import {listMembers} from '@/features/sharing/service';
import {sharingResponse} from '@/features/sharing/http';
export async function GET(_request:Request,context:{params:Promise<{fridgeId:string}>}){try{return sharingResponse(await listMembers(await requireFridgeAccess(parseId((await context.params).fridgeId))))}catch(error){return errorResponse(error)}}
