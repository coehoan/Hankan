import {z} from 'zod';
import {errorResponse} from '@/lib/errors';
import {requireUser} from '@/lib/auth';
import {prepareReceiptUpload} from '@/features/receipts/direct-upload';
import {assertReceiptOrigin,checked,receiptJson,receiptResponse} from '@/features/receipts/http';
const input=z.object({fridgeId:z.string().uuid(),mime:z.string(),size:z.number()}).strict();
export async function POST(request:Request){try{assertReceiptOrigin(request);await requireUser();const body=checked(input,await receiptJson(request));return receiptResponse(await prepareReceiptUpload(body.fridgeId,body.mime,body.size),201)}catch(error){return errorResponse(error)}}
