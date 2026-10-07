import Dexie, { type Table } from 'dexie';
import type { InventoryItem } from '@/domain/inventory';
import type { Recipe, RecipeVersion } from '@/domain/recipe';
import type { MenuDay } from '@/domain/menu';
import type { ShoppingListItem } from '@/domain/shopping-list';
import type { Profile } from '@/domain/profile';
import type { Receipt } from '@/domain/receipt';
import type { NotificationSettings } from '@/domain/notification';

export interface PendingWrite {
  id: string;
  table: string;
  op: 'insert' | 'update' | 'delete';
  payload: object;
  createdAt: string;
}

export interface PendingPhoto {
  id: string;
  blob: Blob;
  createdAt: string;
}

class MenappDB extends Dexie {
  inventoryItems!: Table<InventoryItem, string>;
  recipes!: Table<Recipe, string>;
  menuDays!: Table<MenuDay, string>;
  shoppingListItems!: Table<ShoppingListItem, string>;
  profiles!: Table<Profile, string>;
  pendingWrites!: Table<PendingWrite, string>;
  receipts!: Table<Receipt, string>;
  pendingPhotos!: Table<PendingPhoto, string>;
  notificationSettings!: Table<NotificationSettings, string>;
  recipeVersions!: Table<RecipeVersion, string>;

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
    this.version(2).stores({
      receipts: 'id, status, createdAt',
      pendingPhotos: 'id, createdAt',
    });
    this.version(3).stores({
      notificationSettings: 'id',
    });
    this.version(4).stores({
      recipeVersions: 'id, recipeId, version',
    });
  }
}

export const db = new MenappDB();
