import 'server-only';
import {z} from 'zod';
import {AppError} from '@/lib/errors';
import type {RecipeCandidate} from '@/features/ai/contracts';
import {getRegisteredRecipe} from './catalog';
const text=(max:number)=>z.string().trim().min(1).max(max);
const origin=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('generated')}).strict(),
 z.object({kind:z.literal('catalog'),provider:text(80),recordId:text(200),sourceUrl:z.string().url().max(2000).refine(value=>{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password}).optional()}).strict(),
]);
const recipe=z.object({id:text(100),name:text(120),ingredients:z.array(z.object({name:text(80),amountText:text(200)}).strict()).min(1).max(50),steps:z.array(text(2000)).min(1).max(40),prepMinutes:z.number().int().min(1).max(1440),servings:z.number().int().min(1).max(20),origin}).strict();
const candidates=z.array(recipe).max(30).refine(values=>new Set(values.map(item=>item.id)).size===values.length);
const invalid=()=>new AppError('provider_failed','요리 추천의 재료·조리법을 확인하지 못했어요. 다시 추천해 주세요.');
export async function validateRecipeCandidates(input:unknown):Promise<RecipeCandidate[]>{
 const parsed=candidates.safeParse(input);if(!parsed.success)throw invalid();
 const result:RecipeCandidate[]=[];
 for(const item of parsed.data){
  if(item.origin.kind==='generated'){result.push(item);continue}
  const canonical=await getRegisteredRecipe(item.origin.provider,item.origin.recordId);
  const checked=recipe.safeParse(canonical);
  if(!checked.success||checked.data.origin.kind!=='catalog'||checked.data.origin.provider!==item.origin.provider||checked.data.origin.recordId!==item.origin.recordId)throw invalid();
  result.push(checked.data);
 }
 if(new Set(result.map(item=>item.id)).size!==result.length)throw invalid();return result;
}
