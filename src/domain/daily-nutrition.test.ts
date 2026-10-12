import { describe, expect, it } from 'vitest';
import { dailyNutritionFromMeals } from './daily-nutrition';
import { createComponent, type NewComponentInput } from './component';
import { createAssembledMeal, setEntry, registerFreeMeal } from './meal-assembly';

function baseInput(overrides: Partial<NewComponentInput> = {}): NewComponentInput {
  return {
    name: 'Pollo',
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

describe('dailyNutritionFromMeals', () => {
  it('suma macros de las comidas armadas con componentes', () => {
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'pollo', 300);
    const totals = dailyNutritionFromMeals([meal], [pollo]);
    expect(totals.kcal).toBeCloseTo(165 * 3);
    expect(totals.hasData).toBe(true);
  });

  it('cuenta una comida libre como cubierta', () => {
    const meal = registerFreeMeal('m1', '2026-10-12', 'C', 'Afuera', { kcal: 600, protein: 25, carbs: 70, fat: 20 });
    const totals = dailyNutritionFromMeals([meal], [pollo]);
    expect(totals.kcal).toBe(600);
    expect(totals.hasData).toBe(true);
  });

  it('cuenta los 5 slots sin armar cuando no hay ninguna comida', () => {
    const totals = dailyNutritionFromMeals([], [pollo]);
    expect(totals.hasData).toBe(false);
    expect(totals.slotsWithoutData).toBe(5);
    expect(totals.coveredFraction).toBe(0);
  });

  it('una comida vacía (sin entries, no libre) cuenta como sin datos', () => {
    const meal = createAssembledMeal('m1', '2026-10-12', 'A');
    const totals = dailyNutritionFromMeals([meal], [pollo]);
    expect(totals.hasData).toBe(false);
    expect(totals.slotsWithoutData).toBe(5);
  });

  it('coveredFraction suma el peso de los slots cubiertos', () => {
    let a = createAssembledMeal('m1', '2026-10-12', 'A');
    a = setEntry(a, 'pollo', 150);
    let c = createAssembledMeal('m2', '2026-10-12', 'C');
    c = setEntry(c, 'pollo', 150);
    const totals = dailyNutritionFromMeals([a, c], [pollo]);
    expect(totals.coveredFraction).toBeCloseTo(0.35 + 0.2);
    expect(totals.slotsWithoutData).toBe(3);
  });
});
