import type { MealSlot } from './recipe';

export interface MenuDay {
  id: string;
  date: string;
  slot: MealSlot;
  recipeId: string | null;
  updatedAt: string;
}
