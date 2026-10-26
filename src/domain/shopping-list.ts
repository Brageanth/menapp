import type { InventoryItem } from './inventory';
import { stockAvailable } from './inventory';
import { canonicalAmount, cleanProductName, convertToUnit, normalizeItemName, roundAmount } from './quantity';
import type { Component } from './component';
import { purchaseNames } from './component';
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

/**
 * G1: lo que falta comprar para las comidas armadas con componentes (Armar). Si el componente ya
 * tiene un lote usable (disponible/congelado, sin vencer), se asume cubierto y no se compra; un
 * componente simple pesa por sí mismo y uno preparado aporta sus ingredientes crudos (una sola vez
 * aunque se use en varias comidas — aproximación: la receta del componente ya representa lo que
 * hace falta comprar para una tanda).
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

  function addNeeded(name: string, quantity: number, rawUnit: string) {
    const key = normalizeItemName(name);
    const amount = canonicalAmount(quantity, rawUnit);
    const existing = needed.get(key);
    // Misma unidad canónica ("0.5 kg" + "200 g") se suma; si no se pueden comparar, gana la primera.
    const addable = existing ? convertToUnit(amount, existing.unit) : amount.quantity;
    needed.set(key, {
      name: existing?.name ?? cleanProductName(name),
      unit: existing?.unit ?? amount.unit,
      quantity: (existing?.quantity ?? 0) + (addable ?? amount.quantity),
    });
  }

  for (const meal of meals) {
    if (meal.isFreeMeal) continue;
    for (const entry of meal.entries) {
      const component = componentMap.get(entry.componentId);
      if (!component) continue;
      if (usableBatchesForComponent(batches, component.id, now).length > 0) continue;

      if (component.origin === 'simple') {
        const names = purchaseNames(component);
        for (const name of names) addNeeded(name, entry.quantity / names.length, component.unit);
      } else if (!preparadoHandled.has(component.id)) {
        preparadoHandled.add(component.id);
        for (const ing of component.ingredients ?? []) addNeeded(ing.name, ing.quantity, ing.unit);
      }
    }
  }

  const result: DerivedShoppingItem[] = [];
  for (const ing of needed.values()) {
    // Sin stock comparable (ej. hay "3 unidades" y se pide en g) no se descuenta nada: mejor comprar de más.
    const have = stockAvailable(inventory, ing.name, ing.unit) ?? 0;
    const missingQty = roundAmount(ing.quantity - have);
    if (missingQty > 0) result.push({ name: ing.name, quantity: missingQty, unit: ing.unit, category: guessCategory(ing.name) });
  }
  return result;
}

/** G2: al confirmar una factura, lo que ya se compró deja de hacer falta en la lista. */
export function markPurchasedByNames(items: ShoppingListItem[], purchasedNames: string[]): ShoppingListItem[] {
  const now = new Date().toISOString();
  const purchasedKeys = new Set(purchasedNames.map(normalizeItemName));
  return items.map((item) =>
    !item.purchased && purchasedKeys.has(normalizeItemName(item.name)) ? { ...item, purchased: true, updatedAt: now } : item
  );
}

/**
 * Items pendientes que hacen falta para una comida armada hoy o mañana (ventana de 24h), para la
 * sección "Comprar pronto" de Avisos/Hoy. Un item puede aparecer en varios componentes; se devuelve
 * una vez con el primero que lo necesita.
 */
export interface UrgentShoppingItem extends ShoppingListItem {
  neededFor: string;
}

export function urgentShoppingItemsFromComponents(
  items: ShoppingListItem[],
  meals: AssembledMeal[],
  components: Component[],
  batches: ComponentBatch[],
  todayDateKey: string,
  tomorrowDateKey: string,
  now: Date
): UrgentShoppingItem[] {
  const componentMap = new Map(components.map((c) => [c.id, c]));
  const neededBy = new Map<string, string>();

  for (const meal of meals) {
    if (meal.isFreeMeal) continue;
    if (meal.date !== todayDateKey && meal.date !== tomorrowDateKey) continue;
    for (const entry of meal.entries) {
      const component = componentMap.get(entry.componentId);
      if (!component) continue;
      if (usableBatchesForComponent(batches, component.id, now).length > 0) continue;

      if (component.origin === 'simple') {
        for (const name of purchaseNames(component)) {
          const key = normalizeItemName(name);
          if (!neededBy.has(key)) neededBy.set(key, component.name);
        }
      } else {
        for (const ing of component.ingredients ?? []) {
          const key = normalizeItemName(ing.name);
          if (!neededBy.has(key)) neededBy.set(key, component.name);
        }
      }
    }
  }

  const result: UrgentShoppingItem[] = [];
  for (const item of items) {
    if (item.purchased) continue;
    const neededFor = neededBy.get(normalizeItemName(item.name));
    if (neededFor) result.push({ ...item, neededFor });
  }
  return result;
}

export function reconcileShoppingList(
  derived: DerivedShoppingItem[],
  existing: ShoppingListItem[]
): { toAdd: ShoppingListItem[]; toUpdate: ShoppingListItem[]; toRemove: string[] } {
  const now = new Date().toISOString();
  // Si ya quedaron filas repetidas del mismo producto ("huevo" y "huevos"), sobrevive una sola: la
  // pendiente si hay (una comprada no cubre lo que falta), si no la primera.
  const existingByName = new Map<string, ShoppingListItem>();
  const repeated: string[] = [];
  for (const e of existing) {
    const key = normalizeItemName(e.name);
    const kept = existingByName.get(key);
    if (!kept) existingByName.set(key, e);
    else if (kept.purchased && !e.purchased) {
      repeated.push(kept.id);
      existingByName.set(key, e);
    } else repeated.push(e.id);
  }
  const derivedKeys = new Set(derived.map((d) => normalizeItemName(d.name)));

  const toAdd: ShoppingListItem[] = [];
  const toUpdate: ShoppingListItem[] = [];
  for (const d of derived) {
    const key = normalizeItemName(d.name);
    const match = existingByName.get(key);
    if (!match) {
      toAdd.push({ id: crypto.randomUUID(), name: d.name, quantity: d.quantity, unit: d.unit, category: d.category, purchased: false, updatedAt: now });
    } else if (match.name !== d.name || match.quantity !== d.quantity || match.unit !== d.unit || match.category !== d.category) {
      toUpdate.push({ ...match, name: d.name, quantity: d.quantity, unit: d.unit, category: d.category, updatedAt: now });
    }
  }
  const toRemove = [
    ...existing.filter((e) => !derivedKeys.has(normalizeItemName(e.name))).map((e) => e.id),
    ...repeated.filter((id) => derivedKeys.has(normalizeItemName(existing.find((e) => e.id === id)!.name))),
  ];
  return { toAdd, toUpdate, toRemove };
}
