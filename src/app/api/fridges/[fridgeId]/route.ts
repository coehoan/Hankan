import {z} from 'zod';
import {assertSameOrigin} from '@/lib/auth';
import {errorResponse} from '@/lib/errors';
import {renameFridge} from '@/features/shell/service';
import {inventoryResponse,readInventoryJson} from '@/features/inventory/http';
import {checked} from '@/features/receipts/http';
const input=z.object({name:z.string()}).strict();
export async function PATCH(request:Request,{params}:{params:Promise<{fridgeId:string}>}){
 try{assertSameOrigin(request);const body=checked(input,await readInventoryJson(request));return inventoryResponse(await renameFridge((await params).fridgeId,body.name))}catch(error){return errorResponse(error)}
}
