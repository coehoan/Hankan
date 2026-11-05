import 'server-only';
import { createHash } from 'node:crypto';
import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import type { RecipeCandidate } from '@/features/ai/contracts';

export const FOODSAFETY_PROVIDER = '식품의약품안전처 조리식품 레시피 DB';
const sourceUrl =
  'https://www.foodsafetykorea.go.kr/api/openApiInfo.do?menu_grp=MENU_GRP31&menu_no=661&show_cnt=10&start_idx=1&svc_no=COOKRCP01';
const ttl = 86_400_000;
const rowSchema = z
  .object({
    RCP_SEQ: z.string().regex(/^\d+$/).max(30),
    RCP_NM: z.string().trim().min(1).max(120),
    RCP_PARTS_DTLS: z.string().trim().min(1).max(10000),
  })
  .catchall(z.unknown());

function ingredientParts(text: string, recipeName: string): RecipeCandidate['ingredients'] {
  // Only split commas outside parentheses; the complete original is also displayed.
  const parts: string[] = [];
  let token = '';
  const brackets: string[] = [];
  const prepared = text
    .replaceAll('\r', '')
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/[（]/gu, '(')
    .replace(/[）]/gu, ')')
    .replace(/\[\s*\d+\s*인분\s*\]/gu, '')
    .replace(/^\s*\d+\s*인분\s*기준/gmu, '')
    .replace(/\[[^[\]\r\n]*(?:재료|양념|소스|소개|고명|드레싱)\s*\]/gu, '\n');
  for (const char of prepared) {
    if ('(['.includes(char)) brackets.push(char);
    if (')]'.includes(char) && brackets.pop() !== (char === ')' ? '(' : '[')) return [];
    if ((char === ',' || char === '\n') && brackets.length === 0) {
      parts.push(token);
      token = '';
    } else token += char;
  }
  if (brackets.length) return [];
  parts.push(token);
  const compact = (value: string) => value.replace(/\s/g, '');
  let invalid = false;
  const ingredients = parts.flatMap((part) => {
    const label = /^[^:：>]+[:：>]/u.exec(part)?.[0];
    if (label && /\d/u.test(label)) invalid = true;
    const value = part
      .trim()
      .replace(/^[●•·\-\s]+/u, '')
      .replace(/^[^:：>]+[:：>]\s*/u, '')
      .replace(/^(?:주재료|부재료|양념|고명)\s+/u, '')
      .trim();
    if (
      !value ||
      compact(value) === compact(recipeName) ||
      /^(?:\[\d+인분\]|고명|양념장?|양념재료|주재료|부재료|재료|소스|드레싱)$/u.test(value)
    )
      return [];
    const quantity = /\(?\s*[\d¼-¾⅐-⅞]|\(?\s*(?:약간|적당량|조금|한 ?줌|소량)\)?\s*$/u.exec(value);
    const boundary = quantity?.index ?? value.length;
    let name = value.slice(0, boundary).trim();
    let amountText = value.slice(boundary).trim() || '원문 참고';
    if (name.lastIndexOf('(') > name.lastIndexOf(')')) {
      name = name.replace(/[,，\s]+$/u, '') + ')';
      amountText = amountText.replace(/\)\s*$/u, '');
    }
    // A second ingredient and quantity without a comma cannot safely be matched.
    let outsideAmount = '',
      amountDepth = 0;
    for (const char of amountText) {
      if (char === '(') amountDepth++;
      else if (char === ')') amountDepth--;
      else if (amountDepth === 0) outsideAmount += char;
    }
    if (
      !name ||
      name.length > 80 ||
      amountText.length > 200 ||
      /[가-힣]\s*[\d¼-¾⅐-⅞]/u.test(outsideAmount)
    ) {
      invalid = true;
      return [];
    }
    return [{ name, amountText }];
  });
  return invalid ? [] : ingredients;
}

export function foodSafetyRecipe(input: unknown): RecipeCandidate | null {
  const parsed = rowSchema.safeParse(input);
  if (!parsed.success) return null;
  const row = parsed.data;
  const steps = Array.from(
    { length: 20 },
    (_, index) => row['MANUAL' + String(index + 1).padStart(2, '0')],
  )
    .filter((step): step is string => typeof step === 'string' && !!step.trim())
    .map((step) => step.trim());
  const ingredients = ingredientParts(row.RCP_PARTS_DTLS, row.RCP_NM);
  if (
    !steps.length ||
    steps.some((step) => step.length > 2000) ||
    !ingredients.length ||
    ingredients.length > 50
  )
    return null;
  return {
    id: 'foodsafety:' + row.RCP_SEQ,
    name: row.RCP_NM,
    ingredients,
    ingredientsText: row.RCP_PARTS_DTLS,
    steps,
    prepMinutes: null,
    servings: null,
    origin: { kind: 'catalog', provider: FOODSAFETY_PROVIDER, recordId: row.RCP_SEQ, sourceUrl },
  };
}

const failed = () =>
  new AppError(
    'provider_failed',
    '식약처 레시피 DB를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  );
export function createFoodSafetyCatalog({
  apiKey,
  fetchImpl = fetch,
  now = Date.now,
}: {
  apiKey: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): () => Promise<RecipeCandidate[]> {
  let cached: { until: number; recipes: RecipeCandidate[] } | undefined;
  let pending: Promise<RecipeCandidate[]> | undefined;
  async function load(): Promise<RecipeCandidate[]> {
    const signal = AbortSignal.timeout(20_000);
    const recipes = new Map<string, RecipeCandidate>();
    let total = 1;
    for (let start = 1; start <= total; start += 1000) {
      const response = await fetchImpl(
        'https://openapi.foodsafetykorea.go.kr/api/' +
          encodeURIComponent(apiKey.trim()) +
          '/COOKRCP01/json/' +
          start +
          '/' +
          (start + 999),
        {
          cache: 'no-store',
          signal,
          redirect: 'error',
        },
      );
      if (!response.ok) throw failed();
      const json = await response.json();
      const page = json?.COOKRCP01;
      if (page?.RESULT?.CODE !== 'INFO-000' || !Array.isArray(page.row)) throw failed();
      const count = Number(page.total_count);
      if (
        !Number.isSafeInteger(count) ||
        count < 1 ||
        count > 10000 ||
        (start > 1 && count !== total)
      )
        throw failed();
      total = count;
      if (page.row.length !== Math.min(1000, total - start + 1)) throw failed();
      for (const row of page.row) {
        const recipe = foodSafetyRecipe(row);
        if (recipe) recipes.set(recipe.id, recipe);
      }
    }
    if (!recipes.size) throw failed();
    const result = [...recipes.values()];
    cached = { until: now() + ttl, recipes: result };
    return result;
  }
  return async () => {
    if (!apiKey.trim())
      throw new AppError('provider_unconfigured', '식약처 레시피 DB가 아직 연결되지 않았어요.');
    if (cached && cached.until > now()) return cached.recipes;
    if (!pending)
      pending = load()
        .catch(() => {
          throw failed();
        })
        .finally(() => {
          pending = undefined;
        });
    return pending;
  };
}

let shared: { key: string; load: () => Promise<RecipeCandidate[]> } | undefined;
export async function getFoodSafetyRecipes(): Promise<RecipeCandidate[]> {
  const key = process.env.FOODSAFETY_API_KEY?.trim() ?? '';
  if (!shared || shared.key !== key) {
    const digest = createHash('sha256').update(key).digest('hex');
    shared = {
      key,
      load: unstable_cache(
        createFoodSafetyCatalog({ apiKey: key }),
        ['foodsafety-COOKRCP01-v1', digest],
        { revalidate: ttl / 1000 },
      ),
    };
  }
  return shared.load();
}
