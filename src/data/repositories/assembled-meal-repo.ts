import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { mergePulledRows } from '../sync-pull';
import { supabase } from '../supabase-client';
import type { AssembledMeal } from '@/domain/meal-assembly';

function toRow(meal: AssembledMeal) {
  return {
    id: meal.id,
    date: meal.date,
    slot: meal.slot,
    entries: meal.entries,
    is_free_meal: meal.isFreeMeal ?? null,
    free_meal_description: meal.freeMealDescription ?? null,
    free_meal_estimated_macros: meal.freeMealEstimatedMacros ?? null,
    updated_at: meal.updatedAt,
  };
}

function fromRow(row: Record<string, unknown>): AssembledMeal {
  return {
    id: row.id as string,
    date: row.date as string,
    slot: row.slot as AssembledMeal['slot'],
    entries: row.entries as AssembledMeal['entries'],
    isFreeMeal: (row.is_free_meal as boolean | null) ?? undefined,
    freeMealDescription: (row.free_meal_description as string | null) ?? undefined,
    freeMealEstimatedMacros: (row.free_meal_estimated_macros as AssembledMeal['freeMealEstimatedMacros'] | null) ?? undefined,
    updatedAt: row.updated_at as string,
  };
}

export const assembledMealRepo = {
  async list(): Promise<AssembledMeal[]> {
    return db.assembledMeals.toArray();
  },

  async add(meal: AssembledMeal): Promise<void> {
    await db.assembledMeals.add(meal);
    await enqueueWrite('assembled_meals', 'insert', toRow(meal));
  },

  async update(meal: AssembledMeal): Promise<void> {
    await db.assembledMeals.put(meal);
    await enqueueWrite('assembled_meals', 'update', toRow(meal));
  },

  async remove(id: string): Promise<void> {
    await db.assembledMeals.delete(id);
    await enqueueWrite('assembled_meals', 'delete', { id });
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('assembled_meals').select('*');
    if (data) await mergePulledRows(db.assembledMeals, data.map(fromRow), (m) => m.updatedAt);
  },
};
