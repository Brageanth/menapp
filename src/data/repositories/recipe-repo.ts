import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { supabase } from '../supabase-client';
import type { Recipe } from '@/domain/recipe';

export const recipeRepo = {
  async list(): Promise<Recipe[]> {
    return db.recipes.toArray();
  },

  async add(recipe: Recipe): Promise<void> {
    await db.recipes.add(recipe);
    await enqueueWrite('recipes', 'insert', recipe);
  },

  async update(recipe: Recipe): Promise<void> {
    await db.recipes.put(recipe);
    await enqueueWrite('recipes', 'update', recipe);
  },

  async remove(id: string): Promise<void> {
    await db.recipes.delete(id);
    await enqueueWrite('recipes', 'delete', { id });
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('recipes').select('*');
    if (data) await db.recipes.bulkPut(data as Recipe[]);
  },
};
