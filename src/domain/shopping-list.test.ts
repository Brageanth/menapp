import { describe, expect, it } from 'vitest';
import { createComponent, type NewComponentInput } from './component';
import { createAssembledMeal, setEntry, registerFreeMeal } from './meal-assembly';
import { createBatch } from './component-batch';
import {
  deriveShoppingListFromComponents,
  markPurchasedByNames,
  urgentShoppingItemsFromComponents,
} from './shopping-list';
import type { InventoryItem } from './inventory';
import type { ShoppingListItem } from './shopping-list';

function baseInput(overrides: Partial<NewComponentInput> = {}): NewComponentInput {
  return {
    name: 'Pollo',
    roles: ['proteina'],
    origin: 'simple',
    unit: 'g',
    portion: { typical: 150, min: 100, max: 250, step: 10 },
    weightState: 'crudo',
    macrosBasis: 'per100g',
    macros: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
    isTreat: false,
    ...overrides,
  };
}

const pollo = createComponent('pollo', baseInput());
const arrozPreparado = createComponent(
  'arroz',
  baseInput({ name: 'Arroz cocido', roles: ['base'], origin: 'preparado', ingredients: [{ name: 'arroz crudo', quantity: 500, unit: 'g' }], steps: ['Cocinar'] })
);

describe('deriveShoppingListFromComponents', () => {
  it('pide un componente simple que falta en inventario', () => {
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'pollo', 300);
    const result = deriveShoppingListFromComponents([meal], [pollo], [], [], new Date('2026-10-12'));
    expect(result).toEqual([{ name: 'Pollo', quantity: 300, unit: 'g', category: 'proteinas' }]);
  });

  it('resta lo que ya hay en inventario', () => {
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'pollo', 300);
    const inventory: InventoryItem[] = [{ id: 'i1', name: 'Pollo', quantity: 100, unit: 'g', location: 'nevera', expiresAt: null, updatedAt: '' }];
    const result = deriveShoppingListFromComponents([meal], [pollo], inventory, [], new Date('2026-10-12'));
    expect(result[0].quantity).toBe(200);
  });

  it('no pide nada si hay un lote usable del componente', () => {
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'pollo', 300);
    const batch = createBatch('b1', pollo, '2026-10-11T00:00:00.000Z', 4, 'nevera');
    const result = deriveShoppingListFromComponents([meal], [pollo], [], [batch], new Date('2026-10-12'));
    expect(result).toEqual([]);
  });

  it('expande un componente preparado en sus ingredientes crudos', () => {
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'arroz', 150);
    const result = deriveShoppingListFromComponents([meal], [arrozPreparado], [], [], new Date('2026-10-12'));
    expect(result).toEqual([{ name: 'arroz crudo', quantity: 500, unit: 'g', category: 'despensa' }]);
  });

  it('no repite ingredientes de un preparado usado en varias comidas', () => {
    let m1 = createAssembledMeal('m1', '2026-10-12', 'A');
    m1 = setEntry(m1, 'arroz', 150);
    let m2 = createAssembledMeal('m2', '2026-10-13', 'C');
    m2 = setEntry(m2, 'arroz', 150);
    const result = deriveShoppingListFromComponents([m1, m2], [arrozPreparado], [], [], new Date('2026-10-12'));
    expect(result).toEqual([{ name: 'arroz crudo', quantity: 500, unit: 'g', category: 'despensa' }]);
  });

  it('ignora comidas libres', () => {
    const meal = registerFreeMeal('m1', '2026-10-12', 'A', 'Afuera', { kcal: 500, protein: 20, carbs: 50, fat: 15 });
    const result = deriveShoppingListFromComponents([meal], [pollo], [], [], new Date('2026-10-12'));
    expect(result).toEqual([]);
  });
});

describe('urgentShoppingItemsFromComponents', () => {
  const pending: ShoppingListItem = { id: 'i1', name: 'Pollo', quantity: 300, unit: 'g', category: 'proteinas', purchased: false, updatedAt: '' };

  it('marca urgente un item pendiente necesario hoy', () => {
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'pollo', 300);
    const result = urgentShoppingItemsFromComponents([pending], [meal], [pollo], [], '2026-10-12', '2026-10-13', new Date('2026-10-12'));
    expect(result).toHaveLength(1);
    expect(result[0].neededFor).toBe('Pollo');
  });

  it('no marca urgente si ya está comprado', () => {
    const bought = { ...pending, purchased: true };
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'pollo', 300);
    const result = urgentShoppingItemsFromComponents([bought], [meal], [pollo], [], '2026-10-12', '2026-10-13', new Date('2026-10-12'));
    expect(result).toEqual([]);
  });

  it('no marca urgente si ya hay un lote usable', () => {
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'pollo', 300);
    const batch = createBatch('b1', pollo, '2026-10-11T00:00:00.000Z', 4, 'nevera');
    const result = urgentShoppingItemsFromComponents([pending], [meal], [pollo], [batch], '2026-10-12', '2026-10-13', new Date('2026-10-12'));
    expect(result).toEqual([]);
  });

  it('ignora fechas fuera de hoy/mañana', () => {
    let meal = createAssembledMeal('m1', '2026-10-20', 'A');
    meal = setEntry(meal, 'pollo', 300);
    const result = urgentShoppingItemsFromComponents([pending], [meal], [pollo], [], '2026-10-12', '2026-10-13', new Date('2026-10-12'));
    expect(result).toEqual([]);
  });
});

describe('markPurchasedByNames', () => {
  const items: ShoppingListItem[] = [
    { id: 'i1', name: 'Pollo', quantity: 300, unit: 'g', category: 'proteinas', purchased: false, updatedAt: '' },
    { id: 'i2', name: 'Arroz', quantity: 500, unit: 'g', category: 'despensa', purchased: false, updatedAt: '' },
  ];

  it('marca comprados los que coinciden por nombre', () => {
    const result = markPurchasedByNames(items, ['pollo']);
    expect(result.find((i) => i.id === 'i1')?.purchased).toBe(true);
    expect(result.find((i) => i.id === 'i2')?.purchased).toBe(false);
  });

  it('no toca los que ya estaban comprados', () => {
    const already = [{ ...items[0], purchased: true, updatedAt: 'orig' }];
    const result = markPurchasedByNames(already, ['pollo']);
    expect(result[0].updatedAt).toBe('orig');
  });
});
