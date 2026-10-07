import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { supabase } from '../supabase-client';
import type { ShoppingListItem } from '@/domain/shopping-list';

export const shoppingListRepo = {
  async list(): Promise<ShoppingListItem[]> {
    return db.shoppingListItems.toArray();
  },

  async add(item: ShoppingListItem): Promise<void> {
    await db.shoppingListItems.add(item);
    await enqueueWrite('shopping_list_items', 'insert', item);
  },

  async update(item: ShoppingListItem): Promise<void> {
    await db.shoppingListItems.put(item);
    await enqueueWrite('shopping_list_items', 'update', item);
  },

  async remove(id: string): Promise<void> {
    await db.shoppingListItems.delete(id);
    await enqueueWrite('shopping_list_items', 'delete', { id });
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('shopping_list_items').select('*');
    if (data) await db.shoppingListItems.bulkPut(data as ShoppingListItem[]);
  },
};
