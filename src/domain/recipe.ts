import type { InventoryItem } from './inventory';
import type { MenuDay } from './menu';
import type { Profile } from './profile';


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
  /** Valores nutricionales por 1 porción (servings=1 escalado), opcionales — sin esto no hay escalado real por metas. */
  caloriesPerServing?: number;
  proteinPerServing?: number;
  carbsPerServing?: number;
  fatPerServing?: number;
  /** Número de versión actual (empieza en 1, sube con cada ajuste por IA guardado "como nueva versión"). */
  version?: number;
  /** Si esta receta es una variante creada por ajuste de IA, id de la receta de la que se derivó. */
  parentRecipeId?: string;
  updatedAt: string;
}

/** Snapshot de una versión anterior de una receta, guardado antes de sobreescribirla con un ajuste de IA. */
export interface RecipeVersion {
  id: string;
  recipeId: string;
  version: number;
  name: string;
  ingredients: RecipeIngredient[];
  steps: string[];
  note: string;
  createdAt: string;
}

/**
 * Reparto de kcal diarias por slot. Suma 1. Usado para traducir una meta diaria (kcal/macros)
 * en un presupuesto por comida, tanto en el escalado manual de Receta_B como en F6.
 */
export const SLOT_KCAL_WEIGHTS: Record<MealSlot, number> = {
  D: 0.25,
  M: 0.1,
  A: 0.35,
  O: 0.1,
  C: 0.2,
};

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

/**
 * Porciones necesarias de `recipe` para cubrir el presupuesto de kcal de `kcalTarget` diario
 * de un perfil en el slot de esa receta. Redondea a 0.5 (no tiene sentido pedir 1.37 porciones),
 * mínimo 0.5. Devuelve null si la receta no tiene kcal por porción cargadas.
 */
export function targetServingsForGoal(recipe: Recipe, kcalTarget: number): number | null {
  if (!recipe.caloriesPerServing || recipe.caloriesPerServing <= 0) return null;
  const budget = kcalTarget * SLOT_KCAL_WEIGHTS[recipe.slot];
  const servings = budget / recipe.caloriesPerServing;
  return Math.max(0.5, Math.round(servings * 2) / 2);
}

export interface DailyNutritionTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** false si ninguna receta asignada ese día tiene nutrición por porción cargada — no hay nada que mostrar. */
  hasData: boolean;
}

/**
 * Macros que aporta el menú de un día para un perfil, escalando cada receta asignada a las
 * porciones que le tocan a ese perfil (mismo `targetServingsForGoal` que el escalado manual
 * de Receta_B) en vez de usar `recipe.servings` a secas. Reusado por Metas_B y por cualquier
 * vista que compare menú real contra metas — no inventar otro cálculo.
 */
export function dailyNutritionForProfile(
  menuDaysForDate: MenuDay[],
  recipes: Recipe[],
  profile: Profile
): DailyNutritionTotals {
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  const totals: DailyNutritionTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0, hasData: false };

  for (const day of menuDaysForDate) {
    if (!day.recipeId) continue;
    const recipe = recipeMap.get(day.recipeId);
    if (!recipe || !recipe.caloriesPerServing) continue;

    const servings = (profile.kcalTarget ? targetServingsForGoal(recipe, profile.kcalTarget) : null) ?? recipe.servings;
    totals.hasData = true;
    totals.kcal += recipe.caloriesPerServing * servings;
    totals.protein += (recipe.proteinPerServing ?? 0) * servings;
    totals.carbs += (recipe.carbsPerServing ?? 0) * servings;
    totals.fat += (recipe.fatPerServing ?? 0) * servings;
  }

  return totals;
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
