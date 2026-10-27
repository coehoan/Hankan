import {z} from 'zod';
import {requireFridgeAccess} from '@/lib/auth';
import {AppError,errorResponse} from '@/lib/errors';
import {parseId} from '@/features/inventory/domain';
import {createInvite,listInvites,revokeInvite} from '@/features/sharing/service';
import {emptySharingBody,sharingBody,sharingResponse} from '@/features/sharing/http';
type Context={params:Promise<{fridgeId:string}>};
async function owner(context:Context){return requireFridgeAccess(parseId((await context.params).fridgeId),'owner')}
export async function GET(_request:Request,context:Context){try{return sharingResponse(await listInvites(await owner(context)))}catch(error){return errorResponse(error)}}
export async function POST(request:Request,context:Context){try{await emptySharingBody(request);return sharingResponse(await createInvite(await owner(context)),201)}catch(error){return errorResponse(error)}}
export async function DELETE(request:Request,context:Context){
 try{const parsed=z.object({inviteId:z.string()}).strict().safeParse(await sharingBody(request));if(!parsed.success)throw new AppError('validation','초대 선택을 확인해 주세요.');await revokeInvite(await owner(context),parsed.data.inviteId);return sharingResponse(null)}catch(error){return errorResponse(error)}
}
