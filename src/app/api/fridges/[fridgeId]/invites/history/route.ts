import {requireFridgeAccess} from '@/lib/auth';
import {errorResponse} from '@/lib/errors';
import {parseId} from '@/features/inventory/domain';
import {clearInviteHistory} from '@/features/sharing/service';
import {emptySharingBody,sharingResponse} from '@/features/sharing/http';
export async function DELETE(request:Request,{params}:{params:Promise<{fridgeId:string}>}){
 try{await emptySharingBody(request);const access=await requireFridgeAccess(parseId((await params).fridgeId),'owner');return sharingResponse({deletedCount:await clearInviteHistory(access)})}catch(error){return errorResponse(error)}
}
