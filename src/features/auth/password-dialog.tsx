'use client';
import {useId,useState} from 'react';
import {Dialog} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {AuthForm} from './auth-form';
export function PasswordDialog({onClose,onComplete}:{onClose:()=>void;onComplete:()=>void}){
 const [pending,setPending]=useState(false),formId=useId();
 return <Dialog open title="비밀번호 변경" closeDisabled={pending} onOpenChange={open=>{if(!open)onClose()}}><div className="password-dialog"><AuthForm mode="update-password" formId={formId} externalSubmit onSuccess={onComplete} onPendingChange={setPending}/><div className="password-dialog-actions"><Button type="button" variant="secondary" onClick={onClose} disabled={pending}>취소</Button><Button type="submit" form={formId} disabled={pending}>{pending?'변경 중…':'비밀번호 변경'}</Button></div></div></Dialog>;
}
