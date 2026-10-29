'use client';
import {useState} from 'react';
import {Dialog} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {AuthForm} from './auth-form';
export function PasswordDialog({onClose,onComplete}:{onClose:()=>void;onComplete:()=>void}){
 const [pending,setPending]=useState(false);
 return <Dialog open title="비밀번호 변경" closeDisabled={pending} onOpenChange={open=>{if(!open)onClose()}}><div className="password-dialog"><AuthForm mode="update-password" onSuccess={onComplete} onPendingChange={setPending}/><div className="password-dialog-actions"><Button variant="secondary" onClick={onClose} disabled={pending}>닫기</Button></div></div></Dialog>;
}
