import { describe, expect, it } from 'vitest';
import { createComponent, type NewComponentInput } from './component';
import { createDefaultTemplate } from './meal-template';
import type { InventoryItem } from './inventory';
import { rerollMeal, type RerollInput } from './meal-reroll';

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
const atun = createComponent('atun', input({ name: 'Atún' }));
const lentejas = createComponent('lentejas', input({ name: 'Lentejas' }));
const arroz = createComponent('arroz', input({ name: 'Arroz', roles: ['base'] }));
const espinaca = createComponent('espinaca', input({ name: 'Espinaca', roles: ['verdura'] }));
const all = [pollo, atun, lentejas, arroz, espinaca];

function stock(name: string): InventoryItem {
  return { id: name, name, quantity: 1000, unit: 'g', location: 'nevera', expiresAt: null, updatedAt: '2026-10-12' };
}

function base(overrides: Partial<RerollInput> = {}): RerollInput {
  return {
    template: createDefaultTemplate('default-A', 'A'),
    slot: 'A',
    entries: [
      { componentId: 'pollo', quantity: 150, locked: false },
      { componentId: 'arroz', quantity: 150, locked: false },
      { componentId: 'espinaca', quantity: 150, locked: false },
    ],
    components: all,
    inventory: [],
    batches: [],
    flavorPairs: [],
    ratings: [],
    recentlyUsedComponentIds: new Set(),
    alreadyTriedIds: new Set(),
    slotKcalTarget: null,
    onlyInStock: false,
    now: new Date('2026-10-12'),
    ...overrides,
  };
}

const ids = (r: ReturnType<typeof rerollMeal>) => r.entries.map((e) => e.componentId);

describe('rerollMeal', () => {
  it('cambia la proteína por otra y deja la comida completa', () => {
    const result = rerollMeal(base());
    expect(result.changed).toBe(true);
    expect(ids(result)).not.toContain('pollo');
    expect(ids(result)).toEqual(expect.arrayContaining(['arroz', 'espinaca']));
    expect(result.entries.filter((e) => ['pollo', 'atun', 'lentejas'].includes(e.componentId))).toHaveLength(1);
  });

  it('no repite lo que ya salió en tiradas anteriores', () => {
    const first = rerollMeal(base());
    const picked = ids(first).find((id) => ['atun', 'lentejas'].includes(id))!;
    const second = rerollMeal(base({ entries: first.entries, alreadyTriedIds: new Set(['pollo', picked]) }));
    const protein = ids(second).find((id) => ['pollo', 'atun', 'lentejas'].includes(id))!;
    expect(protein).not.toBe('pollo');
    expect(protein).not.toBe(picked);
  });

  it('respeta lo que tiene candado', () => {
    const entries = [
      { componentId: 'pollo', quantity: 150, locked: true },
      { componentId: 'arroz', quantity: 150, locked: false },
    ];
    const result = rerollMeal(base({ entries }));
    expect(ids(result)).toContain('pollo');
    expect(result.entries.find((e) => e.componentId === 'pollo')?.locked).toBe(true);
  });

  it('con "solo lo que tengo" prefiere lo que hay en la despensa', () => {
    const result = rerollMeal(base({ onlyInStock: true, inventory: [stock('Lentejas'), stock('Arroz'), stock('Espinaca')] }));
    expect(ids(result)).toContain('lentejas');
    expect(ids(result)).not.toContain('atun');
  });

  it('con "solo lo que tengo" completa igual un rol sin nada en la despensa', () => {
    const result = rerollMeal(base({ onlyInStock: true, inventory: [stock('Lentejas')] }));
    expect(ids(result)).toEqual(expect.arrayContaining(['lentejas', 'arroz', 'espinaca']));
  });

  it('un rol con una sola opción la conserva y avisa que no hubo cambio', () => {
    const result = rerollMeal(base({ components: [pollo, arroz, espinaca] }));
    expect(ids(result)).toEqual(expect.arrayContaining(['pollo', 'arroz', 'espinaca']));
    expect(result.changed).toBe(false);
  });

  it('no sugiere componentes que el usuario marcó con "no me gusta"', () => {
    const ratings = [{ id: 'atun', componentId: 'atun', score: -1, updatedAt: '2026-10-12' }];
    const result = rerollMeal(base({ ratings }));
    expect(ids(result)).not.toContain('atun');
  });
});
