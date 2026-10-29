import 'server-only';
import type { AccessContext } from '@/lib/contracts';
import { requireFridgeAccess } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { listIngredients } from '@/features/inventory/service';
import { parseId } from '@/features/inventory/domain';
import { getAiProvider } from '@/features/ai/registry';
import type { RecipeMatch } from './domain';
import { classifyRecipes, inventoryVersion, usableIngredients } from './domain';
import { validateRecipeCandidates } from './validation';
async function todayForUser(userId: string) {
  const client = await createServerSupabaseClient();
  const profile = await client.from('profiles').select('timezone').eq('user_id', userId).single();
  if (profile.error)
    throw new AppError('internal', '날짜 설정을 확인하지 못했어요. 다시 시도해 주세요.');
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: profile.data.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts();
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join('-');
}
export async function recommendForFridgeSnapshot(
  access: AccessContext,
): Promise<{ matches: RecipeMatch[]; inventoryVersion: string; today: string }> {
  const current = await requireFridgeAccess(parseId(access.fridgeId));
  if (current.userId !== access.userId)
    throw new AppError('forbidden', '냉장고 권한을 다시 확인해 주세요.');
  const today = await todayForUser(current.userId),
    items = await listIngredients(current),
    version = inventoryVersion(items),
    usable = usableIngredients(items, today);
  if (!usable.length) return { matches: [], inventoryVersion: version, today };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let matches: RecipeMatch[];
  try {
    const provider = getAiProvider();
    const output = await Promise.race([
      provider.recommendRecipes({ today, ingredients: usable.map((item) => ({ ...item })) }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Recommendation timed out')), 60_000);
      }),
    ]);
    matches = classifyRecipes(await validateRecipeCandidates(output), items, today);
  } catch (error) {
    if (error instanceof AppError && error.code === 'provider_unconfigured')
      throw new AppError(
        'provider_unconfigured',
        '요리 추천 AI가 아직 연결되지 않았어요. 재료 관리는 계속 이용할 수 있어요.',
      );
    throw new AppError(
      'provider_failed',
      '요리 추천을 불러오지 못했어요. 재료는 그대로예요. 잠시 후 다시 시도해 주세요.',
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
  const freshAccess = await requireFridgeAccess(current.fridgeId),
    latest = await listIngredients(freshAccess),
    latestToday = await todayForUser(current.userId);
  if (inventoryVersion(latest) !== version || latestToday !== today)
    throw new AppError(
      'conflict',
      '추천 중 재료나 날짜가 바뀌었어요. 최신 목록으로 다시 추천해 주세요.',
    );
  return { matches, inventoryVersion: version, today };
}
export async function recommendForFridge(access: AccessContext): Promise<RecipeMatch[]> {
  return (await recommendForFridgeSnapshot(access)).matches;
}
