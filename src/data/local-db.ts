import Dexie, { type Table } from 'dexie';
import type { InventoryItem } from '@/domain/inventory';
import type { Recipe } from '@/domain/recipe';
import type { MenuDay } from '@/domain/menu';
import type { ShoppingListItem } from '@/domain/shopping-list';
import type { Profile } from '@/domain/profile';

export interface PendingWrite {
  id: string;
  table: string;
  op: 'insert' | 'update' | 'delete';
  payload: object;
  createdAt: string;
}

class MenappDB extends Dexie {
  inventoryItems!: Table<InventoryItem, string>;
  recipes!: Table<Recipe, string>;
  menuDays!: Table<MenuDay, string>;
  shoppingListItems!: Table<ShoppingListItem, string>;
  profiles!: Table<Profile, string>;
  pendingWrites!: Table<PendingWrite, string>;

  constructor() {
    super('menapp');
    this.version(1).stores({
      inventoryItems: 'id, location, expiresAt',
      recipes: 'id, slot',
      menuDays: 'id, date, slot',
      shoppingListItems: 'id, category, purchased',
      profiles: 'id, personLabel',
      pendingWrites: 'id, table, createdAt',
    });
  }
}

export const db = new MenappDB();
