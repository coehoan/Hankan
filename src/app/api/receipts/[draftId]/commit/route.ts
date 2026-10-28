import {z} from 'zod';
import {errorResponse} from '@/lib/errors';
import {commitReceipt} from '@/features/receipts/service';
import {assertReceiptOrigin,checked,receiptJson,receiptResponse} from '@/features/receipts/http';
const input=z.object({requestId:z.string().uuid(),items:z.array(z.object({name:z.string(),storage:z.enum(['fridge','freezer','pantry']),expiresOn:z.string()}).strict()).min(1).max(100)}).strict();
export async function POST(request:Request,{params}:{params:Promise<{draftId:string}>}){try{assertReceiptOrigin(request);const body=checked(input,await receiptJson(request));return receiptResponse(await commitReceipt((await params).draftId,body.requestId,body.items))}catch(error){return errorResponse(error)}}
