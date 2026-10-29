'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Dialog} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {useOnline} from './connectivity';
import {uploadReceipt} from './upload-client';
export function UploadForm({fridgeId,fridgeName,onClose,onCreated}:{fridgeId:string;fridgeName:string;onClose:()=>void;onCreated:(id:string)=>void}){
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[drafts,setDrafts]=useState<{id:string;created_at:string}[]>([]);const pending=useRef(false),online=useOnline();
 useEffect(()=>{const controller=new AbortController();void fetch('/api/receipts?fridgeId='+encodeURIComponent(fridgeId),{cache:'no-store',signal:controller.signal}).then(async response=>{const json=await response.json();if(response.ok)setDrafts(json.data)}).catch(()=>{});return()=>controller.abort()},[fridgeId]);
 async function upload(event:React.SubmitEvent<HTMLFormElement>){event.preventDefault();if(!file||pending.current||!online)return;if(file.size>10*1024*1024){setError('사진은 10MB 이하로 올려 주세요.');return}pending.current=true;setBusy(true);setError('');try{onCreated(await uploadReceipt(fridgeId,file))}catch(caught){setError(caught instanceof Error?caught.message:'연결을 확인해 주세요.')}finally{pending.current=false;setBusy(false)}}
 return <Dialog open title="영수증으로 등록" closeDisabled={busy} onOpenChange={open=>{if(!open&&!pending.current)onClose()}}><form className="receipt-upload" onSubmit={upload}><p><strong>{fridgeName}</strong>에 등록할 개인 초안을 만들어요.</p><p className="muted">JPEG·PNG·WebP, 최대 10MB. 원본과 초안은 나만 볼 수 있어요. 사진을 올려도 재료는 바로 저장되지 않아요.</p><label className="field">영수증 사진<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>setFile(event.target.files?.[0]??null)} disabled={busy} required/></label>{!online&&<p role="status">연결이 돌아오면 업로드할 수 있어요.</p>}{error&&<p className="form-message error" role="alert">{error}</p>}<Button type="submit" disabled={!online||busy||!file}>{busy?'사진 확인 중…':'사진 올리고 품목 확인'}</Button></form>{drafts.length>0&&<section className="receipt-drafts"><h3>내가 중단한 초안</h3><ul>{drafts.map(draft=><li key={draft.id}><Link href={'/receipts/'+draft.id}>{new Date(draft.created_at).toLocaleString('ko-KR')} 초안 이어서 확인</Link></li>)}</ul></section>}</Dialog>;
}
