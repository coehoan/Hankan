import { z } from 'zod';
import { AppError } from '@/lib/errors';
const schema = z
  .string()
  .trim()
  .refine(
    (value) =>
      [...value].length >= 1 && [...value].length <= 80 && !/[\u0000-\u001f\u007f]/.test(value),
  );
export function parseFridgeName(value: unknown): string {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError('validation', '냉장고 이름을 1~80자로 입력해 주세요.');
  return parsed.data;
}
