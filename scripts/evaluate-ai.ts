import {mkdir,writeFile} from 'node:fs/promises';
import {createSelectedProvider,type AiUsage} from '../src/features/ai/selected-provider';
import {validateRecipeCandidates} from '../src/features/recipes/validation';
import {classifyRecipes} from '../src/features/recipes/domain';
import {renderReceipt,receiptScore,recipeInput,type RecipeFixture} from '../tests/support/ai-fixtures';
import receipts from '../tests/fixtures/ai/receipts.json';
import recipes from '../tests/fixtures/ai/recipes.json';

// Explicit opt-in prevents accidentally spending API credits in CI or offline checks.
if(process.env.HANKAN_AI_LIVE!=='1')throw new Error('Set HANKAN_AI_LIVE=1 to authorize paid synthetic evaluation');
const apiKey=process.env.OPENAI_API_KEY?.trim();
if(!apiKey)throw new Error('Enter OPENAI_API_KEY in .env.local before evaluation');
const outputDir=new URL('../work/ai-evaluation/',import.meta.url);
await mkdir(outputDir,{recursive:true});
const reports:AiUsage[]=[];
const provider=createSelectedProvider({apiKey,model:'gpt-6-luna',onUsage:usage=>reports.push(usage)});
const results:Record<string,unknown>[]=[];
let failures=0;
const usage=()=>{const last=reports.at(-1)!;return {...last,estimatedUsd:Number(((last.inputTokens-last.cachedInputTokens)*0.1/1e6+last.cachedInputTokens*0.01/1e6+last.outputTokens*0.5/1e6).toFixed(8))}};
for(const fixture of receipts){
 try{
  const image=await renderReceipt(fixture);await writeFile(new URL(fixture.id+'.png',outputDir),image.bytes);
  const items=await provider.extractReceipt(image),score=receiptScore(fixture,items),passed=score.missing===0&&score.unexpected===0&&score.excludedDetected===0;
  if(!passed)failures++;results.push({id:fixture.id,passed,...score,needsReview:items.filter(item=>item.needsReview).length,usage:usage()});
 }catch{failures++;results.push({id:fixture.id,passed:false,error:'provider_failed'})}
}
for(const fixture of recipes){
 try{
  const input=recipeInput(fixture as RecipeFixture),candidates=await validateRecipeCandidates(await provider.recommendRecipes(input)),matches=classifyRecipes(candidates,input.ingredients,input.today);
  const passed=candidates.length>0&&matches.length>0;if(!passed)failures++;
  results.push({id:fixture.id,passed,recipes:candidates.length,matched:matches.length,generatedOnly:candidates.every(recipe=>recipe.origin.kind==='generated'),available:matches.filter(match=>match.kind==='available').length,needsShopping:matches.filter(match=>match.kind==='needs-shopping').length,usage:usage()});
  // Synthetic recipe output only, kept out of Git for a human consistency review.
  await writeFile(new URL(fixture.id+'-recipes.json',outputDir),JSON.stringify(candidates,null,2));
 }catch{failures++;results.push({id:fixture.id,passed:false,error:'provider_failed'})}
}
const report={evaluatedAt:new Date().toISOString(),model:'gpt-6-luna',reasoning:'high',imageDetail:'high',synthetic:true,results,failures};
await writeFile(new URL('report.json',outputDir),JSON.stringify(report,null,2));
// Numeric evaluation summaries only. No keys, request/response bodies, or images in logs.
console.log(JSON.stringify(report,null,2));
process.exitCode=failures?1:0;
