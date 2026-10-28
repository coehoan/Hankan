import {z} from 'zod';
import {localTimePattern} from './schedule';
export type NotificationPreferences={enabled:boolean;localTime:string;timezone:string;nextRunAt:string|null};
export const preferenceInput=z.object({enabled:z.boolean(),localTime:z.string().regex(localTimePattern)}).strict();
export const preferenceResponse=preferenceInput.extend({timezone:z.string().min(1).max(100),nextRunAt:z.string().datetime({offset:true}).nullable()}).strict();
