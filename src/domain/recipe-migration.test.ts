import { describe, expect, it } from 'vitest';
import {
  confirmMigration,
  createPendingMigration,
  heuristicDecision,
  isMigrationComplete,
  markApplied,
  migrationProgress,
  proposeMigration,
} from './recipe-migration';
import type { Recipe } from './recipe';

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    name: 'Pollo a la plancha',
    slot: 'A',
    prepTimeMinutes: 15,
    ingredients: [{ name: 'pollo', quantity: 200, unit: 'g' }],
    steps: ['Cocinar'],
    servings: 1,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('createPendingMigration', () => {
  it('arranca pendiente sin revisar', () => {
    const m = createPendingMigration('m1', 'r1');
    expect(m.status).toBe('pending');
    expect(m.reviewedByUser).toBe(false);
  });
});

describe('heuristicDecision', () => {
  it('propone separable para receta simple', () => {
    expect(heuristicDecision(recipe())).toBe('separable');
  });

  it('propone plato completo para receta compleja', () => {
    const complex = recipe({
      ingredients: Array.from({ length: 6 }, (_, i) => ({ name: `ing${i}`, quantity: 1, unit: 'g' })),
      steps: ['uno', 'dos', 'tres'],
    });
    expect(heuristicDecision(complex)).toBe('complete-dish');
  });
});

describe('proposeMigration / confirmMigration / markApplied', () => {
  it('flujo completo: pendiente → propuesta → confirmada → aplicada', () => {
    let m = createPendingMigration('m1', 'r1');
    m = proposeMigration(m, 'separable', [{ input: undefined }], 'Se separa en proteína');
    expect(m.status).toBe('proposed');
    expect(m.reviewedByUser).toBe(false);

    m = confirmMigration(m, 'separable', m.proposedComponents);
    expect(m.reviewedByUser).toBe(true);

    m = markApplied(m);
    expect(m.status).toBe('applied');
  });

  it('no se puede aplicar sin revisión del usuario', () => {
    let m = createPendingMigration('m1', 'r1');
    m = proposeMigration(m, 'separable', [], 'nota');
    expect(() => markApplied(m)).toThrow();
  });
});

describe('migrationProgress / isMigrationComplete', () => {
  it('cuenta aplicadas vs pendientes', () => {
    const records = [
      markApplied(confirmMigration(proposeMigration(createPendingMigration('m1', 'r1'), 'separable', [], ''), 'separable', [])),
      createPendingMigration('m2', 'r2'),
    ];
    expect(migrationProgress(records)).toEqual({ total: 2, applied: 1, pending: 1 });
    expect(isMigrationComplete(records, 2)).toBe(false);
  });

  it('completa cuando todas están aplicadas y cubren el total', () => {
    const records = [markApplied(confirmMigration(proposeMigration(createPendingMigration('m1', 'r1'), 'separable', [], ''), 'separable', []))];
    expect(isMigrationComplete(records, 1)).toBe(true);
  });
});
