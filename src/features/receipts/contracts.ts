import type {ExtractedItem} from '@/features/ai/contracts';
import type {ISODate,StoragePlace} from '@/features/inventory/contracts';
export type ReceiptDraftStatus='uploaded'|'analyzing'|'ready'|'failed'|'saved'|'cancelled';
export type ConfirmedItem={name:string;storage:StoragePlace;expiresOn:ISODate};
export type ReviewItem={id:string;name:string;storage:StoragePlace;expiresOn:string;included:boolean;rawText:string;needsReview:boolean};
export type ReceiptDraft={draftId:string;fridgeId:string;fridgeName:string;status:ReceiptDraftStatus;items:ExtractedItem[];reviewItems?:ReviewItem[]|null;originalUrl:string|null;expiresAt:string};
