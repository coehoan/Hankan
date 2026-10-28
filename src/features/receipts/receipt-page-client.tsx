'use client';
import {useRouter} from 'next/navigation';
import type {ReceiptDraft} from './contracts';
import {ReviewScreen} from './review-screen';
export function ReceiptPageClient({draft}:{draft:ReceiptDraft}){const router=useRouter();const back=()=>{router.replace('/fridges/'+draft.fridgeId);router.refresh()};return <ReviewScreen key={draft.draftId} draft={draft} onSaved={back} onCancel={back}/>}
