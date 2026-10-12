import Dexie, { type Table } from 'dexie';
import type { InventoryItem } from '@/domain/inventory';
import type { Recipe, RecipeVersion } from '@/domain/recipe';
import type { MenuDay } from '@/domain/menu';
import type { ShoppingListItem } from '@/domain/shopping-list';
import type { Profile } from '@/domain/profile';
import type { Receipt } from '@/domain/receipt';
import type { NotificationSettings } from '@/domain/notification';
import type { Component } from '@/domain/component';
import type { MealTemplate } from '@/domain/meal-template';
import type { AssembledMeal } from '@/domain/meal-assembly';
import type { SavedPlate } from '@/domain/saved-plate';
import type { RecipeMigrationRecord } from '@/domain/recipe-migration';

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
  components!: Table<Component, string>;
  mealTemplates!: Table<MealTemplate, string>;
  assembledMeals!: Table<AssembledMeal, string>;
  savedPlates!: Table<SavedPlate, string>;
  recipeMigrations!: Table<RecipeMigrationRecord, string>;

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
    this.version(5).stores({
      components: 'id, status',
      mealTemplates: 'id, slot',
      assembledMeals: 'id, date, slot',
    });
    this.version(6).stores({
      savedPlates: 'id, slot, status',
      recipeMigrations: 'id, recipeId, status',
    });
  }
}

export const db = new MenappDB();
