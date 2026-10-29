export async function uploadReceipt(fridgeId:string,file:File):Promise<string>{
 const prepared=await fetch('/api/receipts/uploads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fridgeId,mime:file.type,size:file.size})});
 const preparation=await prepared.json();if(!prepared.ok)throw new Error(preparation.error?.message??'사진 업로드를 준비하지 못했어요.');
 const uploaded=await fetch(preparation.data.uploadUrl,{method:'PUT',headers:{'Content-Type':file.type,'x-upsert':'false'},body:file});
 if(!uploaded.ok)throw new Error('사진을 올리지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
 const completed=await fetch('/api/receipts/uploads/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fridgeId,objectPath:preparation.data.objectPath})});
 const result=await completed.json();if(!completed.ok)throw new Error(result.error?.message??'사진을 확인하지 못했어요.');return result.data.draftId;
}
