import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { supabase } from '../supabase-client';
import type { InventoryItem } from '@/domain/inventory';

export const inventoryRepo = {
  async list(): Promise<InventoryItem[]> {
    return db.inventoryItems.toArray();
  },

  async add(item: InventoryItem): Promise<void> {
    await db.inventoryItems.add(item);
    await enqueueWrite('inventory_items', 'insert', item);
  },

  async update(item: InventoryItem): Promise<void> {
    await db.inventoryItems.put(item);
    await enqueueWrite('inventory_items', 'update', item);
  },

  async remove(id: string): Promise<void> {
    await db.inventoryItems.delete(id);
    await enqueueWrite('inventory_items', 'delete', { id });
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('inventory_items').select('*');
    if (data) await db.inventoryItems.bulkPut(data as InventoryItem[]);
  },
};
