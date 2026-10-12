import { describe, expect, it } from 'vitest';
import { createComponent, type NewComponentInput } from './component';
import { createAssembledMeal, setEntry, registerFreeMeal } from './meal-assembly';
import { remainingTreatKcal, treatBudgetStatus, treatKcalSpent } from './treat-budget';

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

const helado = createComponent('helado', baseInput({ name: 'Helado', roles: ['postre'], isTreat: true, macros: { kcal: 200, protein: 3, carbs: 24, fat: 10 } }));
const pollo = createComponent('pollo', baseInput());
const gaseosaLight = createComponent(
  'gaseosa',
  baseInput({ name: 'Gaseosa light', roles: ['bebida'], isTreat: true, macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, macrosBasis: 'perUnit', unit: 'unidad' })
);

describe('treatKcalSpent', () => {
  it('suma solo las kcal de componentes marcados gusto', () => {
    let meal = createAssembledMeal('m1', '2026-10-12', 'C');
    meal = setEntry(meal, 'helado', 100);
    meal = setEntry(meal, 'pollo', 150);
    expect(treatKcalSpent([meal], [helado, pollo])).toBeCloseTo(200);
  });

  it('bebidas sin calorías no restan presupuesto', () => {
    let meal = createAssembledMeal('m1', '2026-10-12', 'C');
    meal = setEntry(meal, 'gaseosa', 1);
    expect(treatKcalSpent([meal], [gaseosaLight])).toBe(0);
  });

  it('ignora comidas libres', () => {
    const meal = registerFreeMeal('m1', '2026-10-12', 'A', 'Postre afuera', { kcal: 500, protein: 5, carbs: 60, fat: 20 });
    expect(treatKcalSpent([meal], [helado])).toBe(0);
  });

  it('suma a través de varias comidas', () => {
    let m1 = createAssembledMeal('m1', '2026-10-12', 'C');
    m1 = setEntry(m1, 'helado', 100);
    let m2 = createAssembledMeal('m2', '2026-10-13', 'C');
    m2 = setEntry(m2, 'helado', 50);
    expect(treatKcalSpent([m1, m2], [helado])).toBeCloseTo(300);
  });
});

describe('treatBudgetStatus', () => {
  const budget = { period: 'weekly' as const, kcalAmount: 1000 };

  it('dentro cuando no se pasa', () => {
    expect(treatBudgetStatus(800, budget)).toBe('dentro');
  });

  it('cerca justo por encima', () => {
    expect(treatBudgetStatus(1100, budget)).toBe('cerca');
  });

  it('fuera muy por encima', () => {
    expect(treatBudgetStatus(1500, budget)).toBe('fuera');
  });
});

describe('remainingTreatKcal', () => {
  it('calcula lo que queda sin ir negativo', () => {
    expect(remainingTreatKcal(800, { period: 'weekly', kcalAmount: 1000 })).toBe(200);
    expect(remainingTreatKcal(1500, { period: 'weekly', kcalAmount: 1000 })).toBe(0);
  });
});
