import type { Ingredient, ISODate } from '@/features/inventory/contracts';
export type VerifiedImage = {
  bytes: Uint8Array;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
};
export type ExtractedItem = {
  id: string;
  rawText: string;
  suggestedName: string;
  needsReview: boolean;
};
export type RecipeCandidate = {
  id: string;
  name: string;
  ingredients: { name: string; amountText: string }[];
  steps: string[];
  ingredientsText?: string;
  prepMinutes: number | null;
  servings: number | null;
  origin:
    | { kind: 'generated' }
    | { kind: 'catalog'; provider: string; recordId: string; sourceUrl?: string };
};
export type RecommendationInput = {
  today: ISODate;
  ingredients: Ingredient[];
  selectedIngredientIds?: string[];
};
export interface AiProvider {
  extractReceipt(image: VerifiedImage): Promise<ExtractedItem[]>;
  recommendRecipes(input: RecommendationInput): Promise<RecipeCandidate[]>;
}
