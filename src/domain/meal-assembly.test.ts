import { describe, expect, it } from 'vitest';
import { createComponent } from './component';
import {
  adjustMealToFitKcal,
  createAssembledMeal,
  mealMacros,
  registerFreeMeal,
  removeEntry,
  setEntry,
  toggleLock,
} from './meal-assembly';
import type { NewComponentInput } from './component';

function baseInput(overrides: Partial<NewComponentInput> = {}): NewComponentInput {
  return {
    name: 'Pechuga de pollo',
    roles: ['proteina'],
    origin: 'simple',
    unit: 'g',
    portion: { typical: 150, min: 100, max: 250, step: 10 },
    weightState: 'cocido',
    macrosBasis: 'per100g',
    macros: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
    isTreat: false,
    ...overrides,
  };
}

const pollo = createComponent('pollo', baseInput());
const arroz = createComponent(
  'arroz',
  baseInput({ name: 'Arroz', roles: ['base'], macros: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 }, portion: { typical: 150, min: 100, max: 300, step: 10 } })
);
const postre = createComponent(
  'postre',
  baseInput({ name: 'Helado', roles: ['postre'], isTreat: true, macros: { kcal: 200, protein: 3, carbs: 24, fat: 10 }, portion: { typical: 100, min: 50, max: 150, step: 10 } })
);

describe('setEntry / removeEntry / toggleLock', () => {
  it('agrega y reemplaza entradas por componentId', () => {
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'pollo', 150);
    meal = setEntry(meal, 'pollo', 200);
    expect(meal.entries).toEqual([{ componentId: 'pollo', quantity: 200, locked: false }]);
  });

  it('quita una entrada', () => {
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'pollo', 150);
    meal = removeEntry(meal, 'pollo');
    expect(meal.entries).toEqual([]);
  });

  it('marca candado', () => {
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'pollo', 150);
    meal = toggleLock(meal, 'pollo', true);
    expect(meal.entries[0].locked).toBe(true);
  });
});

describe('mealMacros', () => {
  it('suma macros de todas las entradas', () => {
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'pollo', 200);
    meal = setEntry(meal, 'arroz', 150);
    const totals = mealMacros(meal, [pollo, arroz]);
    expect(totals.kcal).toBeCloseTo(165 * 2 + 130 * 1.5);
  });

  it('usa el estimado si es comida libre', () => {
    const meal = registerFreeMeal('m2', '2026-10-12', 'A', 'Almuerzo en restaurante', { kcal: 800, protein: 30, carbs: 90, fat: 25 });
    expect(mealMacros(meal, [pollo])).toEqual({ kcal: 800, protein: 30, carbs: 90, fat: 25 });
  });
});

describe('adjustMealToFitKcal', () => {
  it('ajusta la base hacia arriba para subir kcal sin tocar la proteína', () => {
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'pollo', 150);
    meal = setEntry(meal, 'arroz', 150);
    const currentKcal = (165 * 1.5) + (130 * 1.5);
    const result = adjustMealToFitKcal(meal, [pollo, arroz], currentKcal + 130);

    const polloEntry = result.meal.entries.find((e) => e.componentId === 'pollo')!;
    expect(polloEntry.quantity).toBe(150);
    const arrozEntry = result.meal.entries.find((e) => e.componentId === 'arroz')!;
    expect(arrozEntry.quantity).toBeGreaterThan(150);
  });

  it('nunca toca una entrada marcada como gusto', () => {
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'postre', 100);
    meal = setEntry(meal, 'arroz', 150);
    const result = adjustMealToFitKcal(meal, [postre, arroz], 1000);
    const postreEntry = result.meal.entries.find((e) => e.componentId === 'postre')!;
    expect(postreEntry.quantity).toBe(100);
  });

  it('nunca toca una entrada con candado', () => {
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'pollo', 150, true);
    meal = setEntry(meal, 'arroz', 150);
    const result = adjustMealToFitKcal(meal, [pollo, arroz], 2000);
    const polloEntry = result.meal.entries.find((e) => e.componentId === 'pollo')!;
    expect(polloEntry.quantity).toBe(150);
  });

  it('respeta el máximo de porción y marca reachedLimit si no alcanza', () => {
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'arroz', 150);
    const result = adjustMealToFitKcal(meal, [arroz], 100000);
    const arrozEntry = result.meal.entries.find((e) => e.componentId === 'arroz')!;
    expect(arrozEntry.quantity).toBe(300);
    expect(result.reachedLimit).toContain('arroz');
    expect(result.incomplete).toBe(true);
  });
});
