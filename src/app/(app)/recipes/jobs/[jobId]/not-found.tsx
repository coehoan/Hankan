import Link from 'next/link';
export default function RecipeNotFound() {
  return (
    <main className="message-page">
      <h1>이 추천 내역을 열 수 없어요</h1>
      <p>주소가 잘못됐거나 삭제 또는 접근 권한 변경으로 열 수 없어요.</p>
      <Link className="primary-button" href="/recipes/history">
        추천 내역으로 돌아가기
      </Link>
    </main>
  );
}
