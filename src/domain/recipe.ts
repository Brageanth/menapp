export type MealSlot = 'D' | 'M' | 'A' | 'O' | 'C';

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  slot: MealSlot;
  prepTimeMinutes: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  servings: number;
  updatedAt: string;
}
