export type ShoppingCategory = 'verduras' | 'proteinas' | 'despensa' | 'otros';

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: ShoppingCategory;
  purchased: boolean;
  updatedAt: string;
}
