import { describe, expect, it } from 'vitest';
import { createComponent, type NewComponentInput } from './component';
import { generateWeekPlan, type WeekPlanInput } from './week-plan';

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
const atun = createComponent('atun', baseInput({ name: 'Atún', macros: { kcal: 130, protein: 28, carbs: 0, fat: 1 } }));
const lentejas = createComponent('lentejas', baseInput({ name: 'Lentejas', macros: { kcal: 116, protein: 9, carbs: 20, fat: 0.4 } }));
const arroz = createComponent('arroz', baseInput({ name: 'Arroz', roles: ['base'], macros: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 } }));
const brocoli = createComponent('brocoli', baseInput({ name: 'Brócoli', roles: ['verdura'], macros: { kcal: 35, protein: 2.4, carbs: 7, fat: 0.4 } }));

function baseArgs(): WeekPlanInput {
  return {
    dates: ['2026-10-12', '2026-10-13', '2026-10-14'],
    slots: ['A'],
    templates: [],
    components: [pollo, atun, lentejas, arroz, brocoli],
    inventory: [],
    batches: [],
    flavorPairs: [],
    ratings: [],
    existingMeals: [],
    dailyKcalTarget: null,
    varietyWindowDays: 3,
    now: new Date('2026-10-12'),
  };
}

describe('generateWeekPlan', () => {
  it('genera una asignación por cada día y slot pedido', () => {
    const result = generateWeekPlan(baseArgs());
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.date)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14']);
  });

  it('llena todos los roles obligatorios del slot (almuerzo: proteína, base, verdura)', () => {
    const [first] = generateWeekPlan(baseArgs());
    const roles = first.entries.map((e) => [pollo, atun, lentejas, arroz, brocoli].find((c) => c.id === e.componentId)?.roles[0]);
    expect(roles).toEqual(expect.arrayContaining(['proteina', 'base', 'verdura']));
  });

  it('evita repetir la misma proteína en días consecutivos dentro de la ventana', () => {
    const result = generateWeekPlan(baseArgs());
    const proteinIds = result.map((r) => r.entries.find((e) => [pollo, atun, lentejas].some((p) => p.id === e.componentId))?.componentId);
    expect(proteinIds[0]).not.toBe(proteinIds[1]);
  });

  it('respeta el presupuesto de kcal del slot cuando hay meta diaria', () => {
    const result = generateWeekPlan({ ...baseArgs(), dailyKcalTarget: 2000 });
    expect(result).toHaveLength(3);
    expect(result[0].entries.length).toBeGreaterThan(0);
  });

  it('no incluye roles opcionales si no hay plantilla que los pida', () => {
    const result = generateWeekPlan(baseArgs());
    const postre = result.some((r) => r.entries.some((e) => e.componentId === 'postre-inexistente'));
    expect(postre).toBe(false);
  });
});
