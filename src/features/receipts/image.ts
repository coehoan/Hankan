import 'server-only';
import sharp from 'sharp';
import { AppError } from '@/lib/errors';
import type { VerifiedImage } from '@/features/ai/contracts';
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export async function verifyReceiptImage(bytes: Uint8Array, mime: string): Promise<VerifiedImage> {
  if (
    !bytes.length ||
    bytes.length > MAX_IMAGE_BYTES ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(mime)
  )
    throw new AppError('validation', 'JPEG·PNG·WebP 사진을 10MB 이하로 올려 주세요.');
  try {
    const image = sharp(bytes, { limitInputPixels: 25_000_000, failOn: 'warning' });
    const metadata = await image.metadata();
    if ('image/' + metadata.format !== mime || (metadata.pages ?? 1) > 1)
      throw new Error('Mismatched image');
    const cleaned = await image.rotate().png().toBuffer();
    if (cleaned.length > MAX_IMAGE_BYTES) throw new Error('Decoded image too large');
    return { bytes: cleaned, mimeType: 'image/png' };
  } catch {
    throw new AppError(
      'validation',
      '사진 형식을 확인하지 못했어요. 손상되지 않은 작은 사진으로 다시 올려 주세요.',
    );
  }
}
