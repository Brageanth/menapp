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
    dailyTarget: null,
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
    const result = generateWeekPlan({ ...baseArgs(), dailyTarget: { kcal: 2000, protein: null, carbs: null, fat: null } });
    expect(result).toHaveLength(3);
    expect(result[0].entries.length).toBeGreaterThan(0);
  });

  it('no incluye roles opcionales si no hay plantilla que los pida', () => {
    const result = generateWeekPlan(baseArgs());
    const postre = result.some((r) => r.entries.some((e) => e.componentId === 'postre-inexistente'));
    expect(postre).toBe(false);
  });

  it('no mete un segundo plato completo en un rol opcional suelto (ej. perro caliente + pasta carbonara)', () => {
    const perroCaliente = createComponent(
      'perro-caliente',
      baseInput({ name: 'Perro caliente', roles: ['proteina', 'base'], isCompleteDish: true })
    );
    const carbonara = createComponent(
      'carbonara',
      baseInput({ name: 'Pasta carbonara', roles: ['base', 'proteina', 'lacteo', 'grasa'], isCompleteDish: true })
    );
    const result = generateWeekPlan({
      ...baseArgs(),
      components: [perroCaliente, carbonara, brocoli],
      inventory: [
        { id: 'inv-1', name: 'Perro caliente', quantity: 1000, unit: 'g', location: 'nevera', expiresAt: null, updatedAt: '2026-10-12' },
      ],
    });
    for (const r of result) {
      const ids = r.entries.map((e) => e.componentId);
      expect(ids).not.toEqual(expect.arrayContaining(['perro-caliente', 'carbonara']));
    }
  });

  it('contributesRoles evita sumar otro componente para un rol que ya cubre nutricionalmente', () => {
    const salsaCarbonara = createComponent(
      'salsa-carbonara',
      baseInput({ name: 'Salsa carbonara', roles: ['grasa'], contributesRoles: ['proteina'] })
    );
    const template = {
      id: 'custom-a',
      slot: 'A' as const,
      name: 'Almuerzo custom',
      slots: [
        { id: 'a-grasa', role: 'grasa' as const, required: true, order: 0 },
        { id: 'a-proteina', role: 'proteina' as const, required: true, order: 1 },
      ],
      updatedAt: '2026-10-12',
    };
    const result = generateWeekPlan({
      ...baseArgs(),
      templates: [template],
      components: [salsaCarbonara, pollo],
    });
    for (const r of result) {
      const ids = r.entries.map((e) => e.componentId);
      expect(ids).toContain('salsa-carbonara');
      expect(ids).not.toContain('pollo');
    }
  });

  it('un componente con contributesRoles nunca es elegible solo para esos roles (solo para los de "roles")', () => {
    const salsaCarbonara = createComponent(
      'salsa-carbonara',
      baseInput({ name: 'Salsa carbonara', roles: ['grasa'], contributesRoles: ['proteina'] })
    );
    const template = {
      id: 'custom-c',
      slot: 'C' as const,
      name: 'Cena custom',
      slots: [{ id: 'c-proteina', role: 'proteina' as const, required: true, order: 0 }],
      updatedAt: '2026-10-12',
    };
    const result = generateWeekPlan({
      ...baseArgs(),
      slots: ['C'],
      templates: [template],
      components: [salsaCarbonara, pollo],
    });
    for (const r of result) {
      expect(r.entries.map((e) => e.componentId)).toEqual(['pollo']);
    }
  });

  it('llena al menos un rol en una comida sin roles obligatorios (onces)', () => {
    const fruta = createComponent('manzana', baseInput({ name: 'Manzana', roles: ['fruta'], macros: { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 } }));
    const result = generateWeekPlan({ ...baseArgs(), slots: ['O'], components: [...baseArgs().components, fruta] });
    expect(result.every((r) => r.entries.length > 0)).toBe(true);
  });
});
