import Link from 'next/link';
import {readDigest} from '@/features/notifications/read-digest';
export const dynamic='force-dynamic';
export default async function DigestPage({params}:{params:Promise<{digestId:string}>}){
 const digest=await readDigest((await params).digestId);
 return <main className="digest-page"><p className="eyebrow">한칸 · 오늘의 알림</p><h1>먼저 사용할 재료</h1><p>지금 참여 중인 냉장고에서 오늘부터 3일 이내인 재료를 모았어요.</p>{digest.groups.length?digest.groups.map(group=><section key={group.fridgeId}><h2><Link href={'/fridges/'+group.fridgeId}>{group.fridgeName}</Link></h2><ul>{group.ingredients.map(i=><li key={i.id}><strong>{i.name}</strong><span>{i.expiresOn} · {i.remainingPercent}% 남음</span></li>)}</ul></section>):<p>지금 확인할 임박 재료가 없어요.</p>}<Link href="/">내 냉장고로</Link></main>;
}
