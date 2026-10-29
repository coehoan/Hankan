import {redirect} from 'next/navigation';
import Link from 'next/link';
import {requireUser} from '@/lib/auth';
import {AppError} from '@/lib/errors';
import {validateInviteToken} from '@/features/sharing/service';
import {InviteScreen} from '@/features/sharing/invite-screen';
import {Brand} from '@/features/auth/auth-frame';
export const metadata={title:'냉장고 초대',robots:{index:false,follow:false}};
export default async function InvitePage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 try{validateInviteToken(token)}catch{return <main className="message-page"><h1>초대를 찾을 수 없어요.</h1><Link href="/">내 냉장고로 돌아가기</Link></main>}
 try{await requireUser()}catch(error){if(error instanceof AppError&&error.code==='unauthenticated')redirect('/login?next='+encodeURIComponent('/invite/'+token));throw error}
 return <main className="invitation-page"><Link className="brand-link" href="/"><Brand/></Link><InviteScreen key={token} token={token}/></main>;
}
