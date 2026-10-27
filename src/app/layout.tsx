import type { Metadata } from 'next';
import './globals.css';

export const metadata:Metadata={title:{default:'한칸 · 신선한 냉장고의 시작',template:'%s · 한칸'},description:'식재료와 유통기한을 함께 관리하고, 남은 재료로 오늘의 한 끼를 찾아보세요.'};

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="ko"><body>{children}</body></html>;
}
