import { z } from 'zod';
import { AppError } from '@/lib/errors';
import type { CreateIngredientInput,Ingredient,IngredientPatch,ISODate } from './contracts';

function isISODate(value: string): boolean {
  if (!/^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const time = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

const date = z.string().refine(isISODate, '유효한 날짜를 선택해 주세요.');
const id = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, '올바른 식별자가 필요해요.');
const name = z.string().trim().refine(value => [...value].length >= 1 && [...value].length <= 80, '재료 이름은 1~80자로 입력해 주세요.');
const storage = z.enum(['fridge', 'freezer', 'pantry']);
const version = z.number().int().min(1).max(2147483647);
const createSchema = z.object({requestId:id,name,storage,expiresOn:date}).strict();
const patchSchema = z.object({
  name:name.optional(),storage:storage.optional(),expiresOn:date.optional(),
  remainingPercent:z.number().int().min(0).max(100).multipleOf(5).optional(),
}).strict().refine(value => Object.values(value).some(field => field !== undefined), '수정할 내용을 입력해 주세요.');

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError('validation', '재료 이름·보관 장소·유통기한·남은 양을 확인해 주세요.');
  return result.data;
}

export function validateISODate(value: unknown): ISODate { return parse(date, value); }
export function parseCreateIngredient(value: unknown): CreateIngredientInput { return parse(createSchema, value); }
export function parseIngredientPatch(value: unknown): IngredientPatch { return parse(patchSchema, value); }
export function parseVersion(value: unknown): number { return parse(version, value); }
export function parseId(value: unknown): string { return parse(id, value); }

export function urgencyOf(expiresOn: ISODate,today: ISODate): 'expired'|'soon'|'normal' {
  const days = (Date.parse(validateISODate(expiresOn)+'T00:00:00Z') - Date.parse(validateISODate(today)+'T00:00:00Z')) / 86400000;
  return days < 0 ? 'expired' : days <= 3 ? 'soon' : 'normal';
}

export function sortIngredients(items: Ingredient[],today: ISODate): Ingredient[] {
  validateISODate(today);
  return [...items].sort((a,b) => a.expiresOn.localeCompare(b.expiresOn) || Date.parse(a.createdAt)-Date.parse(b.createdAt) || a.id.localeCompare(b.id));
}
