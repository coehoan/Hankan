export interface CleanupStore{expire(now:string):Promise<void>;pending():Promise<{id:string;path:string}[]>;remove(path:string):Promise<void>;complete(id:string):Promise<void>}
export async function cleanReceipts(now:string,store:CleanupStore):Promise<{deleted:number;failed:number}>{
 await store.expire(now);let deleted=0,failed=0;
 for(const item of await store.pending())try{await store.remove(item.path);await store.complete(item.id);deleted++}catch{failed++}
 return {deleted,failed};
}
