export type StoragePlace = 'fridge' | 'freezer' | 'pantry';
export type ISODate = string;
export type Ingredient = {
  id: string;
  fridgeId: string;
  name: string;
  normalizedName: string;
  storage: StoragePlace;
  expiresOn: ISODate;
  remainingPercent: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};
export type CreateIngredientInput = { requestId: string; name: string; storage: StoragePlace; expiresOn: ISODate };
export type IngredientPatch = Partial<Pick<Ingredient, 'name' | 'storage' | 'expiresOn' | 'remainingPercent'>>;
