import 'server-only';
import type { RecipeCandidate } from '@/features/ai/contracts';
// Stage 8 registers verified catalog adapters and their canonical records here.
const records: ReadonlyMap<string, RecipeCandidate> = new Map();
export async function getRegisteredRecipe(
  provider: string,
  recordId: string,
): Promise<RecipeCandidate | null> {
  return records.get(provider + '\0' + recordId) ?? null;
}
