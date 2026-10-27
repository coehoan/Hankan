import { notFound } from 'next/navigation';
import { requireFridgeAccess } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Brand } from '@/features/auth/auth-frame';
import { SignOutButton } from '@/features/auth/sign-out-button';

export default async function FridgePage({params}:{params:Promise<{fridgeId:string}>}){
 const {fridgeId}=await params;
 try{await requireFridgeAccess(fridgeId)}catch(error){if(error instanceof AppError&&error.code==='forbidden')notFound();throw error}
 const client=await createServerSupabaseClient();
 const {data,error}=await client.from('fridges').select('name').eq('id',fridgeId).single();
 if(error||!data)notFound();
 return <div className="fridge-page"><header className="app-header"><Brand/><span className="header-current">내 냉장고</span><SignOutButton/></header><main className="fridge-content"><p className="eyebrow">MY LITTLE FRIDGE</p><h1>{data.name}</h1><p className="muted">내 냉장고의 작은 습관을 시작해 보세요.</p><section className="empty-fridge"><div className="empty-leaf" aria-hidden="true">✳</div><h2>재료를 담을 준비가 됐어요</h2><p>이 공간에 식재료와 유통기한을 차곡차곡 모아요.<br/>무엇이 남았는지, 무엇을 먼저 먹을지 한눈에.</p><span className="owned-badge">내 계정에 저장된 냉장고</span></section></main></div>;
}
