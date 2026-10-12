import { describe, expect, it } from 'vitest';
import { applyPlateToMeal, archiveSavedPlate, createSavedPlate, filterSavedPlates, renameSavedPlate } from './saved-plate';
import { createAssembledMeal, setEntry } from './meal-assembly';

const entries = [{ componentId: 'pollo', quantity: 150, locked: false }];

describe('createSavedPlate', () => {
  it('crea un plato con estado activo', () => {
    const plate = createSavedPlate('p1', 'Pollo con arroz', 'A', entries);
    expect(plate.status).toBe('active');
    expect(plate.entries).toEqual(entries);
  });

  it('exige nombre', () => {
    expect(() => createSavedPlate('p1', '  ', 'A', entries)).toThrow();
  });

  it('exige al menos un componente', () => {
    expect(() => createSavedPlate('p1', 'Vacío', 'A', [])).toThrow();
  });
});

describe('archiveSavedPlate / renameSavedPlate', () => {
  it('archiva sin perder datos', () => {
    const plate = createSavedPlate('p1', 'Pollo con arroz', 'A', entries);
    const archived = archiveSavedPlate(plate);
    expect(archived.status).toBe('archived');
    expect(archived.entries).toEqual(entries);
  });

  it('renombra', () => {
    const plate = createSavedPlate('p1', 'Pollo con arroz', 'A', entries);
    expect(renameSavedPlate(plate, 'Pollo arroz v2').name).toBe('Pollo arroz v2');
  });
});

describe('filterSavedPlates', () => {
  const active = createSavedPlate('p1', 'Pollo con arroz', 'A', entries);
  const archived = archiveSavedPlate(createSavedPlate('p2', 'Lentejas', 'C', entries));
  const all = [active, archived];

  it('oculta archivados por defecto', () => {
    expect(filterSavedPlates(all, {})).toEqual([active]);
  });

  it('filtra por slot', () => {
    expect(filterSavedPlates(all, { slot: 'C', includeArchived: true })).toEqual([archived]);
  });

  it('filtra por texto', () => {
    expect(filterSavedPlates(all, { query: 'pollo' })).toEqual([active]);
  });
});

describe('applyPlateToMeal', () => {
  it('reemplaza las entradas de la comida por las del plato', () => {
    const plate = createSavedPlate('p1', 'Pollo con arroz', 'A', entries);
    let meal = createAssembledMeal('m1', '2026-10-12', 'A');
    meal = setEntry(meal, 'otro', 50);
    const result = applyPlateToMeal(meal, plate);
    expect(result.entries).toEqual(entries);
  });
});
