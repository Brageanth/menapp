import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { mergePulledRows } from '../sync-pull';
import { supabase } from '../supabase-client';
import type { MealTemplate } from '@/domain/meal-template';

function toRow(template: MealTemplate) {
  return {
    id: template.id,
    slot: template.slot,
    name: template.name,
    slots: template.slots,
    updated_at: template.updatedAt,
  };
}

function fromRow(row: Record<string, unknown>): MealTemplate {
  return {
    id: row.id as string,
    slot: row.slot as MealTemplate['slot'],
    name: row.name as string,
    slots: row.slots as MealTemplate['slots'],
    updatedAt: row.updated_at as string,
  };
}

export const mealTemplateRepo = {
  async list(): Promise<MealTemplate[]> {
    return db.mealTemplates.toArray();
  },

  async add(template: MealTemplate): Promise<void> {
    await db.mealTemplates.add(template);
    await enqueueWrite('meal_templates', 'insert', toRow(template));
  },

  async update(template: MealTemplate): Promise<void> {
    await db.mealTemplates.put(template);
    await enqueueWrite('meal_templates', 'update', toRow(template));
  },

  async remove(id: string): Promise<void> {
    await db.mealTemplates.delete(id);
    await enqueueWrite('meal_templates', 'delete', { id });
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('meal_templates').select('*');
    if (data) await mergePulledRows(db.mealTemplates, data.map(fromRow), (t) => t.updatedAt);
  },
};
