import {assertSameOrigin,requireUser} from '@/lib/auth';
import {errorResponse} from '@/lib/errors';
import {readInventoryJson,inventoryResponse} from '@/features/inventory/http';
import {deleteBrowserSubscription,getPushConfiguration,registerSubscription} from '@/features/notifications/subscriptions';
export async function GET(){try{return inventoryResponse(await getPushConfiguration())}catch(error){return errorResponse(error)}}
export async function POST(request:Request){try{assertSameOrigin(request);return inventoryResponse(await registerSubscription(await readInventoryJson(request)))}catch(error){return errorResponse(error)}}
export async function DELETE(request:Request){try{assertSameOrigin(request);await requireUser();await deleteBrowserSubscription();return inventoryResponse({connected:false})}catch(error){return errorResponse(error)}}
