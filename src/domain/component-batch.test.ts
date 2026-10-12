import { describe, expect, it } from 'vitest';
import { createComponent, type NewComponentInput } from './component';
import {
  buildPreparationPlan,
  componentsNeedingBatch,
  consumePortions,
  createBatch,
  freezeBatch,
  isExpired,
  markExpired,
  unfreezeBatch,
  usableBatchesForComponent,
} from './component-batch';

function baseInput(overrides: Partial<NewComponentInput> = {}): NewComponentInput {
  return {
    name: 'Arroz',
    roles: ['base'],
    origin: 'preparado',
    unit: 'g',
    portion: { typical: 150, min: 100, max: 300, step: 10 },
    weightState: 'cocido',
    macrosBasis: 'per100g',
    macros: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
    isTreat: false,
    batchable: true,
    cookedShelfLifeDays: 4,
    ingredients: [{ name: 'arroz crudo', quantity: 500, unit: 'g' }],
    steps: ['Cocinar'],
    ...overrides,
  };
}

const arroz = createComponent('arroz', baseInput());

describe('createBatch', () => {
  it('calcula el vencimiento desde la vida útil cocinado', () => {
    const batch = createBatch('b1', arroz, '2026-10-12T00:00:00.000Z', 6, 'nevera');
    expect(batch.status).toBe('available');
    expect(batch.remainingPortions).toBe(6);
    expect(batch.expiresAt).toBe('2026-10-16T00:00:00.000Z');
  });

  it('sin vida útil cargada, expiresAt es null', () => {
    const sinVida = createComponent('arroz2', baseInput({ cookedShelfLifeDays: undefined }));
    const batch = createBatch('b1', sinVida, '2026-10-12T00:00:00.000Z', 4, 'nevera');
    expect(batch.expiresAt).toBeNull();
  });

  it('exige al menos una porción', () => {
    expect(() => createBatch('b1', arroz, '2026-10-12T00:00:00.000Z', 0, 'nevera')).toThrow();
  });
});

describe('consumePortions', () => {
  it('resta porciones', () => {
    const batch = createBatch('b1', arroz, '2026-10-12T00:00:00.000Z', 6, 'nevera');
    const next = consumePortions(batch, 2);
    expect(next.remainingPortions).toBe(4);
    expect(next.status).toBe('available');
  });

  it('pasa a depleted al llegar a cero', () => {
    const batch = createBatch('b1', arroz, '2026-10-12T00:00:00.000Z', 2, 'nevera');
    const next = consumePortions(batch, 2);
    expect(next.remainingPortions).toBe(0);
    expect(next.status).toBe('depleted');
  });

  it('nunca baja de cero', () => {
    const batch = createBatch('b1', arroz, '2026-10-12T00:00:00.000Z', 2, 'nevera');
    const next = consumePortions(batch, 10);
    expect(next.remainingPortions).toBe(0);
  });
});

describe('freezeBatch / unfreezeBatch', () => {
  it('congela y descongela conservando porciones', () => {
    const batch = createBatch('b1', arroz, '2026-10-12T00:00:00.000Z', 4, 'nevera');
    const frozen = freezeBatch(batch);
    expect(frozen.status).toBe('frozen');
    const unfrozen = unfreezeBatch(frozen);
    expect(unfrozen.status).toBe('available');
  });

  it('descongelar sin porciones queda depleted', () => {
    const batch = freezeBatch({ ...createBatch('b1', arroz, '2026-10-12T00:00:00.000Z', 2, 'nevera'), remainingPortions: 0 });
    expect(unfreezeBatch(batch).status).toBe('depleted');
  });
});

describe('markExpired / isExpired', () => {
  it('marca vencido sin borrar datos', () => {
    const batch = createBatch('b1', arroz, '2026-10-12T00:00:00.000Z', 4, 'nevera');
    const expired = markExpired(batch);
    expect(expired.status).toBe('expired');
    expect(expired.remainingPortions).toBe(4);
  });

  it('isExpired compara contra la fecha actual', () => {
    const batch = createBatch('b1', arroz, '2026-10-12T00:00:00.000Z', 4, 'nevera');
    expect(isExpired(batch, new Date('2026-10-20T00:00:00.000Z'))).toBe(true);
    expect(isExpired(batch, new Date('2026-10-13T00:00:00.000Z'))).toBe(false);
  });
});

describe('usableBatchesForComponent', () => {
  it('incluye disponibles y congelados con porciones', () => {
    const b1 = createBatch('b1', arroz, '2026-10-12T00:00:00.000Z', 4, 'nevera');
    const b2 = freezeBatch(createBatch('b2', arroz, '2026-10-12T00:00:00.000Z', 2, 'freezer'));
    const b3 = consumePortions(createBatch('b3', arroz, '2026-10-12T00:00:00.000Z', 1, 'nevera'), 1);
    const now = new Date('2026-10-13T00:00:00.000Z');
    expect(usableBatchesForComponent([b1, b2, b3], 'arroz', now)).toEqual([b1, b2]);
  });

  it('excluye vencidos', () => {
    const b1 = createBatch('b1', arroz, '2026-10-12T00:00:00.000Z', 4, 'nevera');
    const now = new Date('2026-10-20T00:00:00.000Z');
    expect(usableBatchesForComponent([b1], 'arroz', now)).toEqual([]);
  });
});

describe('buildPreparationPlan', () => {
  it('agrupa por esfuerzo y alerta con más de 3 componentes', () => {
    const items = Array.from({ length: 4 }, (_, i) => createComponent(`c${i}`, baseInput({ name: `Comp ${i}`, effort: 'medio' })));
    const plan = buildPreparationPlan(items);
    expect(plan.byEffort.medio).toHaveLength(4);
    expect(plan.tooMuchEffort).toBe(true);
  });

  it('sin alerta con 3 o menos', () => {
    const items = Array.from({ length: 3 }, (_, i) => createComponent(`c${i}`, baseInput({ name: `Comp ${i}` })));
    expect(buildPreparationPlan(items).tooMuchEffort).toBe(false);
  });
});

describe('componentsNeedingBatch', () => {
  it('solo incluye batchable sin lote usable', () => {
    const conLote = createComponent('con-lote', baseInput({ name: 'Con lote' }));
    const sinLote = createComponent('sin-lote', baseInput({ name: 'Sin lote' }));
    const batch = createBatch('b1', conLote, '2026-10-12T00:00:00.000Z', 4, 'nevera');
    const now = new Date('2026-10-13T00:00:00.000Z');
    expect(componentsNeedingBatch([conLote, sinLote], [batch], now)).toEqual([sinLote]);
  });
});
