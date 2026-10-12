import { describe, expect, it } from 'vitest';
import { createComponent, type NewComponentInput } from './component';
import { createFlavorPair } from './flavor-pair';
import { createBatch } from './component-batch';
import { nextAlternative, suggestComponentsForRole, type SuggestionContext } from './suggestion';
import type { InventoryItem } from './inventory';

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
const lentejas = createComponent('lentejas', baseInput({ name: 'Lentejas', macros: { kcal: 116, protein: 9, carbs: 20, fat: 0.4 } }));
const atun = createComponent('atun', baseInput({ name: 'Atún', macros: { kcal: 130, protein: 28, carbs: 0, fat: 1 }, effort: 'alto' }));

function baseContext(overrides: Partial<SuggestionContext> = {}): SuggestionContext {
  return {
    role: 'proteina',
    candidates: [pollo, lentejas, atun],
    inventory: [],
    batches: [],
    flavorPairs: [],
    ratings: [],
    recentlyUsedComponentIds: new Set(),
    alreadyInMeal: [],
    remainingKcal: null,
    now: new Date('2026-10-12'),
    ...overrides,
  };
}

describe('suggestComponentsForRole', () => {
  it('devuelve al menos 3 alternativas', () => {
    const result = suggestComponentsForRole(baseContext());
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('solo incluye componentes que tienen el rol pedido', () => {
    const verdura = createComponent('verdura', baseInput({ name: 'Brócoli', roles: ['verdura'] }));
    const result = suggestComponentsForRole(baseContext({ candidates: [pollo, verdura] }));
    expect(result.map((r) => r.component.id)).not.toContain('verdura');
  });

  it('prioriza lo que vence pronto por encima de todo', () => {
    const inventory: InventoryItem[] = [{ id: 'i1', name: 'Pollo', quantity: 200, unit: 'g', location: 'nevera', expiresAt: '2026-10-13', updatedAt: '' }];
    const result = suggestComponentsForRole(baseContext({ inventory, remainingKcal: 100 }));
    expect(result[0].component.id).toBe('pollo');
    expect(result[0].reason).toContain('vence');
  });

  it('descarta por completo un "evitar" explícito', () => {
    const pairs = [createFlavorPair('p1', 'pollo', 'lentejas', 'evitar')];
    const result = suggestComponentsForRole(baseContext({ flavorPairs: pairs, alreadyInMeal: ['lentejas'] }));
    expect(result.map((r) => r.component.id)).not.toContain('pollo');
  });

  it('favorece lo que "va bien" explícitamente', () => {
    const pairs = [createFlavorPair('p1', 'pollo', 'lentejas', 'bien')];
    const result = suggestComponentsForRole(baseContext({ flavorPairs: pairs, alreadyInMeal: ['lentejas'] }));
    const pollito = result.find((r) => r.component.id === 'pollo');
    expect(pollito?.reason).toContain('combina bien');
  });

  it('penaliza lo usado recientemente para dar variedad', () => {
    const recent = suggestComponentsForRole(baseContext({ recentlyUsedComponentIds: new Set(['pollo']) }));
    const fresh = suggestComponentsForRole(baseContext());
    const polloRecent = recent.find((r) => r.component.id === 'pollo')!;
    const polloFresh = fresh.find((r) => r.component.id === 'pollo')!;
    expect(polloRecent.score).toBeLessThan(polloFresh.score);
  });

  it('prefiere lo disponible en lote usable', () => {
    const batch = createBatch('b1', atun, '2026-10-11T00:00:00.000Z', 4, 'nevera');
    const result = suggestComponentsForRole(baseContext({ batches: [batch] }));
    const atunScore = result.find((r) => r.component.id === 'atun')!;
    expect(atunScore.reason).toBe('ya la tenés disponible');
  });

  it('ajusta el orden según calificaciones previas', () => {
    const ratings = [{ id: 'lentejas', componentId: 'lentejas', score: 10, updatedAt: '' }];
    const result = suggestComponentsForRole(baseContext({ ratings }));
    expect(result[0].component.id).toBe('lentejas');
  });
});

describe('nextAlternative', () => {
  it('devuelve la siguiente sugerencia no mostrada', () => {
    const all = suggestComponentsForRole(baseContext());
    const shown = [all[0].component.id];
    const next = nextAlternative(all, shown);
    expect(next?.component.id).toBe(all[1].component.id);
  });

  it('null si ya se mostraron todas', () => {
    const all = suggestComponentsForRole(baseContext());
    const shown = all.map((s) => s.component.id);
    expect(nextAlternative(all, shown)).toBeNull();
  });
});
