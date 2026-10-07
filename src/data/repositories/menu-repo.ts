import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { supabase } from '../supabase-client';
import type { MenuDay } from '@/domain/menu';

/** Supabase columns are snake_case; local/domain objects are camelCase. */
function toRow(menuDay: MenuDay) {
  return {
    id: menuDay.id,
    date: menuDay.date,
    slot: menuDay.slot,
    recipe_id: menuDay.recipeId,
    updated_at: menuDay.updatedAt,
  };
}

function fromRow(row: Record<string, unknown>): MenuDay {
  return {
    id: row.id as string,
    date: row.date as string,
    slot: row.slot as MenuDay['slot'],
    recipeId: (row.recipe_id as string | null) ?? null,
    updatedAt: row.updated_at as string,
  };
}

export const menuRepo = {
  async list(): Promise<MenuDay[]> {
    return db.menuDays.toArray();
  },

  async add(menuDay: MenuDay): Promise<void> {
    await db.menuDays.add(menuDay);
    await enqueueWrite('menu_days', 'insert', toRow(menuDay));
  },

  async update(menuDay: MenuDay): Promise<void> {
    await db.menuDays.put(menuDay);
    await enqueueWrite('menu_days', 'update', toRow(menuDay));
  },

  async remove(id: string): Promise<void> {
    await db.menuDays.delete(id);
    await enqueueWrite('menu_days', 'delete', { id });
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('menu_days').select('*');
    if (data) await db.menuDays.bulkPut(data.map(fromRow));
  },

  /** Re-pushes every locally held menu day, bypassing the write queue — used for one-time disaster recovery. */
  async resyncAll(): Promise<void> {
    const all = await db.menuDays.toArray();
    for (const menuDay of all) await enqueueWrite('menu_days', 'update', toRow(menuDay));
  },
};
