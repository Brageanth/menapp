import type { MenuDay } from './menu';
import type { Recipe, RecipeIngredient } from './recipe';
import type { InventoryItem } from './inventory';
import type { Component } from './component';
import type { AssembledMeal } from './meal-assembly';
import type { ComponentBatch } from './component-batch';
import { usableBatchesForComponent } from './component-batch';

export type ShoppingCategory = 'verduras' | 'proteinas' | 'despensa' | 'otros';

export const CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  verduras: 'Verduras',
  proteinas: 'Proteínas',
  despensa: 'Despensa',
  otros: 'Otros',
};

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: ShoppingCategory;
  purchased: boolean;
  updatedAt: string;
}

const CATEGORY_KEYWORDS: Record<ShoppingCategory, string[]> = {
  proteinas: ['pollo', 'carne', 'res', 'cerdo', 'pescado', 'atun', 'huevo', 'huevos', 'lenteja', 'frijol', 'garbanzo', 'tofu'],
  verduras: ['tomate', 'cebolla', 'lechuga', 'zanahoria', 'papa', 'platano', 'aguacate', 'brocoli', 'espinaca', 'pimenton', 'ajo', 'fruta', 'frutas'],
  despensa: ['arroz', 'pasta', 'aceite', 'harina', 'sal', 'azucar', 'leche', 'queso', 'pan', 'avena', 'enlatado'],
  otros: [],
};

export function guessCategory(name: string): ShoppingCategory {
  const n = name.toLowerCase();
  for (const cat of ['proteinas', 'verduras', 'despensa'] as ShoppingCategory[]) {
    if (CATEGORY_KEYWORDS[cat].some((kw) => n.includes(kw))) return cat;
  }
  return 'otros';
}

export interface DerivedShoppingItem {
  name: string;
  quantity: number;
  unit: string;
  category: ShoppingCategory;
}

/** Combina dos listas derivadas (ej. desde recetas y desde componentes) sumando por nombre. */
export function mergeDerivedShoppingItems(...lists: DerivedShoppingItem[][]): DerivedShoppingItem[] {
  const merged = new Map<string, DerivedShoppingItem>();
  for (const item of lists.flat()) {
    const key = item.name.toLowerCase().trim();
    const existing = merged.get(key);
    merged.set(key, existing ? { ...existing, quantity: existing.quantity + item.quantity } : item);
  }
  return [...merged.values()];
}

/** Agrega ingredientes de las recetas asignadas en menuDays por nombre normalizado, mismo matching que domain/recipe.ts missingIngredients. */
export function deriveShoppingList(
  menuDays: MenuDay[],
  recipes: Recipe[],
  inventory: InventoryItem[]
): DerivedShoppingItem[] {
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  const needed = new Map<string, { quantity: number; unit: string; name: string }>();

  for (const day of menuDays) {
    if (!day.recipeId) continue;
    const recipe = recipeMap.get(day.recipeId);
    if (!recipe) continue;
    for (const ing of recipe.ingredients as RecipeIngredient[]) {
      const key = ing.name.toLowerCase().trim();
      const existing = needed.get(key);
      needed.set(key, {
        name: existing?.name ?? ing.name,
        unit: existing?.unit ?? ing.unit,
        quantity: (existing?.quantity ?? 0) + ing.quantity,
      });
    }
  }

  const result: DerivedShoppingItem[] = [];
  for (const [key, ing] of needed) {
    const stock = inventory.find((i) => i.name.toLowerCase().trim() === key);
    const missingQty = Math.round((ing.quantity - (stock?.quantity ?? 0)) * 100) / 100;
    if (missingQty > 0) {
      result.push({ name: ing.name, quantity: missingQty, unit: ing.unit, category: guessCategory(ing.name) });
    }
  }
  return result;
}

/**
 * Items de la lista que hacen falta para una receta asignada hoy o mañana (ventana de 24h),
 * para la sección "Para comprar hoy" de Compras_B y las tarjetas de Avisos_B. Un item puede
 * aparecer en varias recetas; se devuelve una vez con la primera receta que lo necesita.
 */
export interface UrgentShoppingItem extends ShoppingListItem {
  neededForRecipeName: string;
}

export function urgentShoppingItems(
  items: ShoppingListItem[],
  menuDays: MenuDay[],
  recipes: Recipe[],
  todayDateKey: string,
  tomorrowDateKey: string
): UrgentShoppingItem[] {
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  const neededBy = new Map<string, string>();

  for (const day of menuDays) {
    if (!day.recipeId) continue;
    if (day.date !== todayDateKey && day.date !== tomorrowDateKey) continue;
    const recipe = recipeMap.get(day.recipeId);
    if (!recipe) continue;
    for (const ing of recipe.ingredients as RecipeIngredient[]) {
      const key = ing.name.toLowerCase().trim();
      if (!neededBy.has(key)) neededBy.set(key, recipe.name);
    }
  }

  const result: UrgentShoppingItem[] = [];
  for (const item of items) {
    if (item.purchased) continue;
    const recipeName = neededBy.get(item.name.toLowerCase().trim());
    if (recipeName) result.push({ ...item, neededForRecipeName: recipeName });
  }
  return result;
}

/**
 * G1: lo mismo que `deriveShoppingList` pero a partir de las comidas armadas con componentes
 * (Armar) en vez de recetas. Si el componente ya tiene un lote usable (disponible/congelado, sin
 * vencer), se asume cubierto y no se compra; si no, un componente simple pesa por sí mismo y uno
 * preparado aporta sus ingredientes crudos (sin escalar por cantidad — aproximación: la receta del
 * componente ya representa lo que hace falta comprar para una tanda).
 */
export function deriveShoppingListFromComponents(
  meals: AssembledMeal[],
  components: Component[],
  inventory: InventoryItem[],
  batches: ComponentBatch[],
  now: Date
): DerivedShoppingItem[] {
  const componentMap = new Map(components.map((c) => [c.id, c]));
  const needed = new Map<string, { quantity: number; unit: string; name: string }>();
  const preparadoHandled = new Set<string>();

  function addNeeded(name: string, quantity: number, unit: string) {
    const key = name.toLowerCase().trim();
    const existing = needed.get(key);
    needed.set(key, { name: existing?.name ?? name, unit: existing?.unit ?? unit, quantity: (existing?.quantity ?? 0) + quantity });
  }

  for (const meal of meals) {
    if (meal.isFreeMeal) continue;
    for (const entry of meal.entries) {
      const component = componentMap.get(entry.componentId);
      if (!component) continue;
      if (usableBatchesForComponent(batches, component.id, now).length > 0) continue;

      if (component.origin === 'simple') {
        addNeeded(component.name, entry.quantity, component.unit);
      } else if (!preparadoHandled.has(component.id)) {
        preparadoHandled.add(component.id);
        for (const ing of component.ingredients ?? []) addNeeded(ing.name, ing.quantity, ing.unit);
      }
    }
  }

  const result: DerivedShoppingItem[] = [];
  for (const [key, ing] of needed) {
    const stock = inventory.find((i) => i.name.toLowerCase().trim() === key);
    const missingQty = Math.round((ing.quantity - (stock?.quantity ?? 0)) * 100) / 100;
    if (missingQty > 0) result.push({ name: ing.name, quantity: missingQty, unit: ing.unit, category: guessCategory(ing.name) });
  }
  return result;
}

/** G2: al confirmar una factura, lo que ya se compró deja de hacer falta en la lista. */
export function markPurchasedByNames(items: ShoppingListItem[], purchasedNames: string[]): ShoppingListItem[] {
  const now = new Date().toISOString();
  const purchasedKeys = new Set(purchasedNames.map((n) => n.toLowerCase().trim()));
  return items.map((item) =>
    !item.purchased && purchasedKeys.has(item.name.toLowerCase().trim()) ? { ...item, purchased: true, updatedAt: now } : item
  );
}

export function reconcileShoppingList(
  derived: DerivedShoppingItem[],
  existing: ShoppingListItem[]
): { toAdd: ShoppingListItem[]; toUpdate: ShoppingListItem[]; toRemove: string[] } {
  const now = new Date().toISOString();
  const existingByName = new Map(existing.map((e) => [e.name.toLowerCase().trim(), e]));
  const derivedKeys = new Set(derived.map((d) => d.name.toLowerCase().trim()));

  const toAdd: ShoppingListItem[] = [];
  const toUpdate: ShoppingListItem[] = [];
  for (const d of derived) {
    const key = d.name.toLowerCase().trim();
    const match = existingByName.get(key);
    if (!match) {
      toAdd.push({ id: crypto.randomUUID(), name: d.name, quantity: d.quantity, unit: d.unit, category: d.category, purchased: false, updatedAt: now });
    } else if (match.quantity !== d.quantity || match.category !== d.category) {
      toUpdate.push({ ...match, quantity: d.quantity, category: d.category, updatedAt: now });
    }
  }
  const toRemove = existing.filter((e) => !derivedKeys.has(e.name.toLowerCase().trim())).map((e) => e.id);
  return { toAdd, toUpdate, toRemove };
}
