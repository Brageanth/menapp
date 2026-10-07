import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { mergePulledRows } from '../sync-pull';
import { supabase } from '../supabase-client';
import type { RecipeVersion } from '@/domain/recipe';

/** Supabase columns are snake_case; local/domain objects are camelCase. */
function toRow(entry: RecipeVersion) {
  return {
    id: entry.id,
    recipe_id: entry.recipeId,
    version: entry.version,
    name: entry.name,
    ingredients: entry.ingredients,
    steps: entry.steps,
    note: entry.note,
    created_at: entry.createdAt,
  };
}

function fromRow(row: Record<string, unknown>): RecipeVersion {
  return {
    id: row.id as string,
    recipeId: row.recipe_id as string,
    version: Number(row.version),
    name: row.name as string,
    ingredients: row.ingredients as RecipeVersion['ingredients'],
    steps: row.steps as string[],
    note: row.note as string,
    createdAt: row.created_at as string,
  };
}

export const recipeVersionRepo = {
  async listByRecipe(recipeId: string): Promise<RecipeVersion[]> {
    const all = await db.recipeVersions.where('recipeId').equals(recipeId).toArray();
    return all.sort((a, b) => b.version - a.version);
  },

  async add(entry: RecipeVersion): Promise<void> {
    await db.recipeVersions.add(entry);
    await enqueueWrite('recipe_versions', 'insert', toRow(entry));
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('recipe_versions').select('*');
    if (data) await mergePulledRows(db.recipeVersions, data.map(fromRow));
  },
};
