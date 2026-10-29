import sharp from 'sharp';
import type { Ingredient } from '../../src/features/inventory/contracts';
import type { RecommendationInput, VerifiedImage } from '../../src/features/ai/contracts';
export type ReceiptFixture = {
  id: string;
  lines: string[];
  expected: { name: string; aliases: string[] }[];
  excluded: string[];
};
export type RecipeFixture = {
  id: string;
  today: string;
  ingredients: Pick<Ingredient, 'name' | 'remainingPercent' | 'expiresOn' | 'storage'>[];
};
const escape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
export async function renderReceipt(fixture: ReceiptFixture): Promise<VerifiedImage> {
  const height = 140 + fixture.lines.length * 72;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="${height}"><rect width="100%" height="100%" fill="white"/><g fill="black" font-family="Malgun Gothic, sans-serif" font-size="36">${fixture.lines.map((line, i) => `<text x="48" y="${90 + i * 72}" xml:space="preserve">${escape(line)}</text>`).join('')}</g></svg>`;
  return { bytes: await sharp(Buffer.from(svg)).png().toBuffer(), mimeType: 'image/png' };
}
export function recipeInput(fixture: RecipeFixture): RecommendationInput {
  return {
    today: fixture.today,
    ingredients: fixture.ingredients.map((item, index) => ({
      ...item,
      id: `fixture-${index}`,
      fridgeId: 'synthetic',
      normalizedName: item.name,
      createdBy: 'synthetic',
      updatedBy: 'synthetic',
      version: 1,
      createdAt: '2026-10-28T00:00:00Z',
      updatedAt: '2026-10-28T00:00:00Z',
    })),
  };
}
export function receiptScore(fixture: ReceiptFixture, items: { suggestedName: string }[]) {
  const names = items.map((item) => item.suggestedName.normalize('NFKC').replaceAll(' ', ''));
  const hits = fixture.expected.filter((expected) =>
    [expected.name, ...expected.aliases].some((name) => names.includes(name)),
  ).length;
  const unexpected = names.filter(
    (name) =>
      !fixture.expected.some((expected) => [expected.name, ...expected.aliases].includes(name)),
  ).length;
  return {
    expected: fixture.expected.length,
    detected: items.length,
    hits,
    missing: fixture.expected.length - hits,
    unexpected,
    excludedDetected: names.filter((name) =>
      fixture.excluded.some((excluded) => name.includes(excluded)),
    ).length,
  };
}
