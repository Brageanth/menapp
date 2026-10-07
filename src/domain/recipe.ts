import type { InventoryItem } from './inventory';

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
  proteinTag?: string;
  updatedAt: string;
}

export const SLOT_LABELS: Record<MealSlot, string> = {
  D: 'Desayuno',
  M: 'Media mañana',
  A: 'Almuerzo',
  O: 'Onces',
  C: 'Cena',
};

export function filterRecipesByQuery(recipes: Recipe[], query: string): Recipe[] {
  const q = query.trim().toLowerCase();
  if (!q) return recipes;
  return recipes.filter((r) => r.name.toLowerCase().includes(q));
}

function roundQty(n: number): number {
  return Math.round(n * 100) / 100;
}

export function scaleIngredients(recipe: Recipe, targetServings: number): RecipeIngredient[] {
  const ratio = targetServings / recipe.servings;
  return recipe.ingredients.map((ing) => ({ ...ing, quantity: roundQty(ing.quantity * ratio) }));
}

export function missingIngredients(
  recipe: Recipe,
  inventory: InventoryItem[],
  targetServings: number = recipe.servings
): RecipeIngredient[] {
  const scaled = scaleIngredients(recipe, targetServings);
  return scaled.filter((ing) => {
    const stock = inventory.find((i) => i.name.toLowerCase() === ing.name.toLowerCase());
    return !stock || stock.quantity < ing.quantity;
  });
}
