import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { mergePulledRows } from '../sync-pull';
import { supabase } from '../supabase-client';
import type { Recipe } from '@/domain/recipe';

/** Supabase columns are snake_case; local/domain objects are camelCase. */
function toRow(recipe: Recipe) {
  return {
    id: recipe.id,
    name: recipe.name,
    slot: recipe.slot,
    prep_time_minutes: recipe.prepTimeMinutes,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    servings: recipe.servings,
    protein_tag: recipe.proteinTag ?? null,
    calories_per_serving: recipe.caloriesPerServing ?? null,
    protein_per_serving: recipe.proteinPerServing ?? null,
    carbs_per_serving: recipe.carbsPerServing ?? null,
    fat_per_serving: recipe.fatPerServing ?? null,
    version: recipe.version ?? 1,
    parent_recipe_id: recipe.parentRecipeId ?? null,
    updated_at: recipe.updatedAt,
  };
}

function fromRow(row: Record<string, unknown>): Recipe {
  return {
    id: row.id as string,
    name: row.name as string,
    slot: row.slot as Recipe['slot'],
    prepTimeMinutes: Number(row.prep_time_minutes),
    ingredients: row.ingredients as Recipe['ingredients'],
    steps: row.steps as string[],
    servings: Number(row.servings),
    proteinTag: (row.protein_tag as string | null) ?? undefined,
    caloriesPerServing: (row.calories_per_serving as number | null) ?? undefined,
    proteinPerServing: (row.protein_per_serving as number | null) ?? undefined,
    carbsPerServing: (row.carbs_per_serving as number | null) ?? undefined,
    fatPerServing: (row.fat_per_serving as number | null) ?? undefined,
    version: (row.version as number | null) ?? 1,
    parentRecipeId: (row.parent_recipe_id as string | null) ?? undefined,
    updatedAt: row.updated_at as string,
  };
}

export const recipeRepo = {
  async list(): Promise<Recipe[]> {
    return db.recipes.toArray();
  },

  async add(recipe: Recipe): Promise<void> {
    await db.recipes.add(recipe);
    await enqueueWrite('recipes', 'insert', toRow(recipe));
  },

  async update(recipe: Recipe): Promise<void> {
    await db.recipes.put(recipe);
    await enqueueWrite('recipes', 'update', toRow(recipe));
  },

  async remove(id: string): Promise<void> {
    await db.recipes.delete(id);
    await enqueueWrite('recipes', 'delete', { id });
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('recipes').select('*');
    if (data) await mergePulledRows(db.recipes, data.map(fromRow), (r) => r.updatedAt);
  },

  /** Re-pushes every locally held recipe, bypassing the write queue — used for one-time disaster recovery. */
  async resyncAll(): Promise<void> {
    const all = await db.recipes.toArray();
    for (const recipe of all) await enqueueWrite('recipes', 'update', toRow(recipe));
  },
};
