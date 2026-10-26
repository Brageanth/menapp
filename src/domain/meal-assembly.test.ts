import { describe, expect, it } from 'vitest';
import { createComponent } from './component';
import {
  copyMeal,
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

describe('copyMeal', () => {
  it('copia las entradas a una nueva fecha/slot con nuevo id', () => {
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'pollo', 200, true);
    const copy = copyMeal(meal, 'm2', '2026-10-13', 'C');
    expect(copy.id).toBe('m2');
    expect(copy.date).toBe('2026-10-13');
    expect(copy.slot).toBe('C');
    expect(copy.entries).toEqual(meal.entries);
  });

  it('copia una comida libre con su estimado', () => {
    const meal = registerFreeMeal('m1', '2026-10-12', 'A', 'Asado', { kcal: 900, protein: 40, carbs: 20, fat: 50 });
    const copy = copyMeal(meal, 'm2', '2026-10-13');
    expect(copy.isFreeMeal).toBe(true);
    expect(copy.freeMealDescription).toBe('Asado');
  });
});
