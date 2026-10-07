import type { InventoryItem } from './inventory';
import type { Recipe, RecipeIngredient } from './recipe';

export interface IngredientDiff {
  added: RecipeIngredient[];
  removed: string[];
  changed: RecipeIngredient[];
}

export interface RecipeAdjustment {
  summary: string;
  ingredientsDiff: IngredientDiff;
  newSteps: string[] | null;
}

/** Aplica el diff de la IA sobre los ingredientes de la receta: cambia los que matchean por nombre normalizado, quita los removidos, agrega los nuevos al final. Mismo matching normalizado que domain/recipe.ts. */
export function applyIngredientsDiff(ingredients: RecipeIngredient[], diff: IngredientDiff): RecipeIngredient[] {
  const removedKeys = new Set(diff.removed.map((n) => n.toLowerCase().trim()));
  const changedByKey = new Map(diff.changed.map((ing) => [ing.name.toLowerCase().trim(), ing]));

  const kept = ingredients
    .filter((ing) => !removedKeys.has(ing.name.toLowerCase().trim()))
    .map((ing) => changedByKey.get(ing.name.toLowerCase().trim()) ?? ing);

  const keptKeys = new Set(kept.map((ing) => ing.name.toLowerCase().trim()));
  const newlyAdded = diff.added.filter((ing) => !keptKeys.has(ing.name.toLowerCase().trim()));

  return [...kept, ...newlyAdded];
}

export function applyRecipeAdjustment(recipe: Recipe, adjustment: RecipeAdjustment): Pick<Recipe, 'ingredients' | 'steps'> {
  return {
    ingredients: applyIngredientsDiff(recipe.ingredients, adjustment.ingredientsDiff),
    steps: adjustment.newSteps ?? recipe.steps,
  };
}

/** Ingredientes agregados por el ajuste que no están cubiertos por la despensa actual — van a la lista de compras. */
export function newIngredientsMissingFromInventory(
  diff: IngredientDiff,
  inventory: InventoryItem[]
): RecipeIngredient[] {
  return diff.added.filter((ing) => {
    const stock = inventory.find((i) => i.name.toLowerCase().trim() === ing.name.toLowerCase().trim());
    return !stock || stock.quantity < ing.quantity;
  });
}
