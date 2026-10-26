import { describe, expect, it } from 'vitest';
import { createComponent, macrosForQuantity, type NewComponentInput } from './component';
import { sizeMeals } from './meal-sizing';

function input(overrides: Partial<NewComponentInput> = {}): NewComponentInput {
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

const pollo = createComponent('pollo', input());
const arroz = createComponent(
  'arroz',
  input({ name: 'Arroz', roles: ['base'], macros: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 }, portion: { typical: 150, min: 80, max: 300, step: 10 } })
);
const brocoli = createComponent(
  'brocoli',
  input({ name: 'Brócoli', roles: ['verdura'], macros: { kcal: 35, protein: 2.4, carbs: 7, fat: 0.4 }, portion: { typical: 100, min: 50, max: 200, step: 10 } })
);
const helado = createComponent(
  'helado',
  input({ name: 'Helado', roles: ['postre'], isTreat: true, macros: { kcal: 200, protein: 3, carbs: 24, fat: 10 }, portion: { typical: 100, min: 50, max: 150, step: 10 } })
);
const perro = createComponent(
  'perro',
  input({ name: 'Perro caliente', unit: 'unidad', macrosBasis: 'perUnit', macros: { kcal: 290, protein: 11, carbs: 24, fat: 17 }, portion: { typical: 1, min: 1, max: 3, step: 1 } })
);

const all = [pollo, arroz, brocoli, helado, perro];
const target = { kcal: 1000, protein: 80, carbs: null, fat: null };

describe('sizeMeals', () => {
  it('acerca los macros del total a la meta', () => {
    const meals = [[
      { componentId: 'pollo', quantity: 150, locked: false },
      { componentId: 'arroz', quantity: 150, locked: false },
      { componentId: 'brocoli', quantity: 100, locked: false },
    ]];
    const before = Math.abs(1000 - (165 * 1.5 + 130 * 1.5 + 35));
    const result = sizeMeals({ meals, components: all, target });
    expect(Math.abs(1000 - result.totals.kcal)).toBeLessThan(before);
    expect(result.totals.protein).toBeGreaterThanOrEqual(80 * 0.9);
  });

  it('reparte el ajuste en varios componentes en vez de inflar uno al máximo', () => {
    const meals = [[
      { componentId: 'pollo', quantity: 150, locked: false },
      { componentId: 'arroz', quantity: 150, locked: false },
      { componentId: 'brocoli', quantity: 100, locked: false },
    ]];
    const result = sizeMeals({ meals, components: all, target: { kcal: 700, protein: null, carbs: null, fat: null } });
    const qty = (id: string) => result.meals[0].find((e) => e.componentId === id)!.quantity;
    expect(qty('arroz')).toBeLessThan(arroz.portion.max);
    expect(qty('pollo')).toBeLessThan(pollo.portion.max);
  });

  it('respeta min/max/paso de cada componente', () => {
    const meals = [[{ componentId: 'arroz', quantity: 150, locked: false }]];
    const result = sizeMeals({ meals, components: all, target: { kcal: 600, protein: null, carbs: null, fat: null } });
    expect(result.meals[0][0].quantity).toBe(arroz.portion.max);
    expect(result.atLimit).toContain('arroz');
  });

  it('nunca toca gustos ni entradas con candado, pero los cuenta como macros fijos', () => {
    const meals = [[
      { componentId: 'helado', quantity: 100, locked: false },
      { componentId: 'pollo', quantity: 150, locked: true },
      { componentId: 'arroz', quantity: 150, locked: false },
    ]];
    const result = sizeMeals({ meals, components: all, target });
    expect(result.meals[0].find((e) => e.componentId === 'helado')!.quantity).toBe(100);
    expect(result.meals[0].find((e) => e.componentId === 'pollo')!.quantity).toBe(150);
    const expectedFixed = macrosForQuantity(helado, 100).kcal + macrosForQuantity(pollo, 150).kcal;
    expect(result.totals.kcal).toBeGreaterThanOrEqual(expectedFixed);
  });

  it('trata una porción por unidad con enteros', () => {
    const meals = [[{ componentId: 'perro', quantity: 1, locked: false }]];
    const result = sizeMeals({ meals, components: all, target: { kcal: 600, protein: null, carbs: null, fat: null } });
    expect(Number.isInteger(result.meals[0][0].quantity)).toBe(true);
  });

  it('cuenta los macros fijos del resto del día al dimensionar una sola comida', () => {
    const meals = [[{ componentId: 'arroz', quantity: 150, locked: false }]];
    const alone = sizeMeals({ meals, components: all, target: { kcal: 600, protein: null, carbs: null, fat: null } });
    const withFixed = sizeMeals({
      meals,
      components: all,
      target: { kcal: 600, protein: null, carbs: null, fat: null },
      fixed: { kcal: 300, protein: 0, carbs: 0, fat: 0 },
    });
    expect(withFixed.meals[0][0].quantity).toBeLessThan(alone.meals[0][0].quantity);
  });
});
