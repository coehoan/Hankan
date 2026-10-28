'use client';
import {ViewState} from '@/components/ui/view-state';
import {Button} from '@/components/ui/button';
export default function ErrorPage({reset}:{reset:()=>void}){return <ViewState title="화면을 불러오지 못했어요" description="연결을 확인하고 다시 시도해 주세요."><Button className="retry-page" onClick={reset}>다시 시도</Button></ViewState>}
