import { describe, expect, it } from 'vitest';
import { createFlavorPair, pairsFor, relationBetween } from './flavor-pair';

describe('createFlavorPair', () => {
  it('crea un par con relación', () => {
    const pair = createFlavorPair('p1', 'pollo', 'arroz', 'bien');
    expect(pair.relation).toBe('bien');
  });

  it('rechaza un par con el mismo componente en ambos lados', () => {
    expect(() => createFlavorPair('p1', 'pollo', 'pollo', 'bien')).toThrow();
  });
});

describe('relationBetween', () => {
  const pairs = [createFlavorPair('p1', 'pollo', 'arroz', 'bien'), createFlavorPair('p2', 'pollo', 'leche', 'evitar')];

  it('encuentra la relación en el orden guardado', () => {
    expect(relationBetween(pairs, 'pollo', 'arroz')).toBe('bien');
  });

  it('encuentra la relación en orden invertido', () => {
    expect(relationBetween(pairs, 'arroz', 'pollo')).toBe('bien');
  });

  it('null si no hay par explícito', () => {
    expect(relationBetween(pairs, 'pollo', 'brocoli')).toBeNull();
  });
});

describe('pairsFor', () => {
  it('devuelve todos los pares que involucran un componente', () => {
    const pairs = [createFlavorPair('p1', 'pollo', 'arroz', 'bien'), createFlavorPair('p2', 'pollo', 'leche', 'evitar'), createFlavorPair('p3', 'arroz', 'frijol', 'bien')];
    expect(pairsFor(pairs, 'pollo')).toHaveLength(2);
  });
});
