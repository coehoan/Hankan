import 'server-only';
import {requireUser} from '@/lib/auth';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {AppError} from '@/lib/errors';
import {parseId} from '@/features/inventory/domain';
import {parseDigest} from './outbox';
import type {Digest} from './types';
export async function readDigest(digestId:string):Promise<Digest>{await requireUser();const {data,error}=await (await createServerSupabaseClient()).rpc('read_notification_digest',{digest_id:parseId(digestId)});if(error||!data)throw new AppError('not_found','알림을 찾을 수 없어요.');return parseDigest(data)}
