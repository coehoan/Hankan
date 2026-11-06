import type { Ingredient } from '@/features/inventory/contracts';
import type { RecipeMatch } from './domain';
export type RecipeJobStatus = 'queued' | 'running' | 'complete' | 'failed' | 'cancelled';
export type RecipeJob = {
  id: string;
  fridgeId: string;
  status: RecipeJobStatus;
  matches: RecipeMatch[];
  ingredients: Ingredient[];
  inventoryVersion: string;
  today: string;
  createdAt: string;
  completedAt: string | null;
};
export const recipeJobPending = (job: RecipeJob) =>
  job.status === 'queued' || job.status === 'running';
