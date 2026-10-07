import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { supabase } from '../supabase-client';
import type { ShoppingListItem } from '@/domain/shopping-list';

/** Supabase columns are snake_case; local/domain objects are camelCase. */
function toRow(item: ShoppingListItem) {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    purchased: item.purchased,
    updated_at: item.updatedAt,
  };
}

function fromRow(row: Record<string, unknown>): ShoppingListItem {
  return {
    id: row.id as string,
    name: row.name as string,
    quantity: Number(row.quantity),
    unit: row.unit as string,
    category: row.category as ShoppingListItem['category'],
    purchased: Boolean(row.purchased),
    updatedAt: row.updated_at as string,
  };
}

export const shoppingListRepo = {
  async list(): Promise<ShoppingListItem[]> {
    return db.shoppingListItems.toArray();
  },

  async add(item: ShoppingListItem): Promise<void> {
    await db.shoppingListItems.add(item);
    await enqueueWrite('shopping_list_items', 'insert', toRow(item));
  },

  async update(item: ShoppingListItem): Promise<void> {
    await db.shoppingListItems.put(item);
    await enqueueWrite('shopping_list_items', 'update', toRow(item));
  },

  async remove(id: string): Promise<void> {
    await db.shoppingListItems.delete(id);
    await enqueueWrite('shopping_list_items', 'delete', { id });
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('shopping_list_items').select('*');
    if (data) await db.shoppingListItems.bulkPut(data.map(fromRow));
  },

  /** Re-pushes every locally held item, bypassing the write queue — used for one-time disaster recovery. */
  async resyncAll(): Promise<void> {
    const all = await db.shoppingListItems.toArray();
    for (const item of all) await enqueueWrite('shopping_list_items', 'update', toRow(item));
  },
};
