import { describe, expect, it } from 'vitest';
import { combinedDailyNutrition } from './daily-nutrition';
import { createComponent, type NewComponentInput } from './component';
import { createAssembledMeal, setEntry, registerFreeMeal } from './meal-assembly';
import type { Profile } from './profile';
import type { Recipe } from './recipe';

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

const profile: Profile = {
  id: 'yo',
  personLabel: 'yo',
  kcalTarget: 2000,
  proteinTarget: 120,
  carbsTarget: 200,
  fatTarget: 60,
  treatBudgetKcal: null,
  treatBudgetPeriod: null,
};

describe('combinedDailyNutrition', () => {
  it('suma solo lo armado con componentes cuando no hay menú de recetas', () => {
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'pollo', 300);
    const totals = combinedDailyNutrition([], [], profile, [meal], [pollo]);
    expect(totals.kcal).toBeCloseTo(165 * 3);
    expect(totals.hasData).toBe(true);
  });

  it('cuenta una comida libre como cubierta', () => {
    const meal = registerFreeMeal('m1', '2026-10-12', 'C', 'Afuera', { kcal: 600, protein: 25, carbs: 70, fat: 20 });
    const totals = combinedDailyNutrition([], [], profile, [meal], [pollo]);
    expect(totals.kcal).toBe(600);
    expect(totals.hasData).toBe(true);
  });

  it('no suma un slot dos veces si ya tiene receta con macros', () => {
    const recipe: Recipe = {
      id: 'r1',
      name: 'Pollo con arroz',
      slot: 'A',
      prepTimeMinutes: 20,
      ingredients: [],
      steps: [],
      servings: 1,
      caloriesPerServing: 500,
      proteinPerServing: 40,
      carbsPerServing: 50,
      fatPerServing: 10,
      updatedAt: '',
    };
    const menuDay = { id: 'md1', date: '2026-10-12', slot: 'A' as const, recipeId: 'r1', updatedAt: '' };
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'pollo', 300);
    const totals = combinedDailyNutrition([menuDay], [recipe], profile, [meal], [pollo]);
    // dailyNutritionForProfile ya escala la receta al presupuesto del slot (700kcal para A con
    // esta meta) — lo que importa acá es que el componente de ese mismo slot no se suma encima.
    expect(totals.kcal).toBe(700);
  });

  it('ignora una comida de componentes vacía (sin entries, no libre)', () => {
    const meal = createAssembledMeal('m1', '2026-10-12', 'A');
    const totals = combinedDailyNutrition([], [], profile, [meal], [pollo]);
    expect(totals.hasData).toBe(false);
  });
});
