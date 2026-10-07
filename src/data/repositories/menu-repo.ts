import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { supabase } from '../supabase-client';
import type { MenuDay } from '@/domain/menu';

export const menuRepo = {
  async list(): Promise<MenuDay[]> {
    return db.menuDays.toArray();
  },

  async add(menuDay: MenuDay): Promise<void> {
    await db.menuDays.add(menuDay);
    await enqueueWrite('menu_days', 'insert', menuDay);
  },

  async update(menuDay: MenuDay): Promise<void> {
    await db.menuDays.put(menuDay);
    await enqueueWrite('menu_days', 'update', menuDay);
  },

  async remove(id: string): Promise<void> {
    await db.menuDays.delete(id);
    await enqueueWrite('menu_days', 'delete', { id });
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('menu_days').select('*');
    if (data) await db.menuDays.bulkPut(data as MenuDay[]);
  },
};
