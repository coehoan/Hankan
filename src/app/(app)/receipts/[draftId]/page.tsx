import Link from 'next/link';
import { AppError } from '@/lib/errors';
import { getReceiptDraft } from '@/features/receipts/service';
import { ReceiptPageClient } from '@/features/receipts/receipt-page-client';
export const metadata = { title: '영수증 확인', robots: { index: false, follow: false } };
export default async function ReceiptPage({ params }: { params: Promise<{ draftId: string }> }) {
  let draft;
  try {
    draft = await getReceiptDraft((await params).draftId);
  } catch (error) {
    if (!(
      error instanceof AppError && ['not_found', 'forbidden', 'validation'].includes(error.code)
    ))
      throw error;
  }
  if (!draft)
    return (
      <main className="message-page">
        <h1>초안을 열 수 없어요</h1>
        <p>초안이 만료되었거나 접근 권한이 변경됐어요.</p>
        <Link href="/">내 냉장고로 돌아가기</Link>
      </main>
    );
  return <ReceiptPageClient draft={draft} />;
}
