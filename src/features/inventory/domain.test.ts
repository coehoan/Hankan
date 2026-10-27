import { describe,expect,it } from 'vitest';
import { parseCreateIngredient,parseId,parseIngredientPatch,parseVersion,sortIngredients,urgencyOf,validateISODate } from './domain';
import type { Ingredient } from './contracts';

const input={requestId:'10000000-0000-4000-8000-000000000001',name:'  대파  ',storage:'fridge',expiresOn:'2028-02-29'};

describe('ingredient input and calendar rules',()=>{
 it.each([
  ['2026-10-25','2026-10-26','expired'],['2026-10-26','2026-10-26','soon'],
  ['2026-10-29','2026-10-26','soon'],['2026-10-30','2026-10-26','normal'],
  ['2028-03-01','2028-02-27','soon'],['2027-01-02','2026-12-30','soon'],
 ])('classifies %s relative to %s as %s',(date,today,want)=>expect(urgencyOf(date,today)).toBe(want));
 it.each(['2028-02-29','2000-02-29','0001-01-01','9999-12-31'])('accepts real date %s',date=>expect(validateISODate(date)).toBe(date));
 it.each(['2026-02-30','2026-02-29','1900-02-29','2026-13-01','2026-00-01','2026-01-00','0000-01-01','2026-1-01','2026-01-01T00:00:00Z',' 2026-01-01',null])('rejects invalid date %s',date=>expect(()=>validateISODate(date)).toThrow(expect.objectContaining({code:'validation'})));
 it('trims a name while keeping separate purchase batches possible',()=>expect(parseCreateIngredient(input)).toEqual({...input,name:'대파'}));
 it.each(['',' \t\n ','\u00a0\u3000','가'.repeat(81)])('rejects blank or overlong names',name=>expect(()=>parseCreateIngredient({...input,name})).toThrow(expect.objectContaining({code:'validation'})));
 it('allows eighty Unicode characters without counting emoji twice',()=>expect(parseCreateIngredient({...input,name:'🥬'.repeat(80)}).name).toHaveLength(160));
 it.each([{storage:'cupboard'},{expiresOn:null},{requestId:'not-a-uuid'},{remainingPercent:5},{createdBy:'forged'}])('rejects invalid create fields %j',patch=>expect(()=>parseCreateIngredient({...input,...patch})).toThrow(expect.objectContaining({code:'validation'})));
 it.each([0,5,95,100])('allows remaining amount %s',remainingPercent=>expect(parseIngredientPatch({remainingPercent})).toEqual({remainingPercent}));
 it.each([-5,1,33.5,105,'50',null])('rejects invalid remaining amount %s',remainingPercent=>expect(()=>parseIngredientPatch({remainingPercent})).toThrow(expect.objectContaining({code:'validation'})));
 it.each([{},null,[],{name:' '},{expiresOn:'2026-02-30'},{fridgeId:'forged'},{version:99}])('rejects empty or protected patches %j',patch=>expect(()=>parseIngredientPatch(patch)).toThrow(expect.objectContaining({code:'validation'})));
 it('validates positive integer versions and canonical identifiers',()=>{
  expect(parseVersion(1)).toBe(1);expect(parseId(input.requestId)).toBe(input.requestId);
  for(const value of [0,-1,1.5,'1',null,2147483648])expect(()=>parseVersion(value)).toThrow(expect.objectContaining({code:'validation'}));
  expect(()=>parseId('../other')).toThrow(expect.objectContaining({code:'validation'}));
 });
 it('sorts expired and soon items by expiry then creation without mutating input',()=>{
  const make=(id:string,expiresOn:string,createdAt:string)=>({id,expiresOn,createdAt} as Ingredient);
  const items=[make('normal','2026-11-01','2026-10-01T00:00:00Z'),make('late','2026-10-28','2026-10-02T00:00:00Z'),make('expired','2026-10-25','2026-10-03T00:00:00Z'),make('early','2026-10-28','2026-10-01T00:00:00Z')];
  expect(sortIngredients(items,'2026-10-26').map(item=>item.id)).toEqual(['expired','early','late','normal']);
  expect(items.map(item=>item.id)).toEqual(['normal','late','expired','early']);
 });
});
