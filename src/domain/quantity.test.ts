import { describe, expect, it } from 'vitest';
import { canonicalAmount, convertToUnit, formatAmount, normalizeItemName } from './quantity';

describe('canonicalAmount', () => {
  it('lleva kg, L y variantes de escritura a g, ml y unidad', () => {
    expect(canonicalAmount(0.2, 'Kg')).toEqual({ quantity: 200, unit: 'g' });
    expect(canonicalAmount(0.505, 'kg')).toEqual({ quantity: 505, unit: 'g' });
    expect(canonicalAmount(1.5, 'L')).toEqual({ quantity: 1500, unit: 'ml' });
    expect(canonicalAmount(2, 'unidades')).toEqual({ quantity: 2, unit: 'unidad' });
    expect(canonicalAmount(1, 'docena')).toEqual({ quantity: 12, unit: 'unidad' });
  });

  it('unidad vacía cuenta como unidades y una desconocida queda tal cual', () => {
    expect(canonicalAmount(3, '')).toEqual({ quantity: 3, unit: 'unidad' });
    expect(canonicalAmount(2, 'Manojo')).toEqual({ quantity: 2, unit: 'manojo' });
  });
});

describe('convertToUnit', () => {
  it('compara misma dimensión sin peso por unidad', () => {
    expect(convertToUnit({ quantity: 0.5, unit: 'kg' }, 'g')).toBe(500);
  });

  it('no mezcla unidades con gramos si no hay peso por unidad', () => {
    expect(convertToUnit({ quantity: 3, unit: 'unidad' }, 'g')).toBeNull();
    expect(convertToUnit({ quantity: 300, unit: 'g' }, 'ml')).toBeNull();
  });

  it('puentea unidades y gramos con el peso por unidad', () => {
    expect(convertToUnit({ quantity: 3, unit: 'unidad' }, 'g', 200)).toBe(600);
    expect(convertToUnit({ quantity: 400, unit: 'g' }, 'unidad', 200)).toBe(2);
  });
});

describe('formatAmount', () => {
  it('elige la unidad más legible', () => {
    expect(formatAmount({ quantity: 1500, unit: 'g' })).toBe('1.5 kg');
    expect(formatAmount({ quantity: 0.2, unit: 'Kg' })).toBe('200 g');
    expect(formatAmount({ quantity: 1, unit: 'unidad' })).toBe('1 unidad');
    expect(formatAmount({ quantity: 3, unit: 'unidad' })).toBe('3 unidades');
    expect(formatAmount({ quantity: 750, unit: 'ml' })).toBe('750 ml');
  });
});

describe('normalizeItemName', () => {
  it('iguala plural, acento y mayúsculas', () => {
    expect(normalizeItemName('Camarones')).toBe(normalizeItemName('camarón'));
    expect(normalizeItemName('Tomates Cherry')).toBe(normalizeItemName('tomate cherry'));
    expect(normalizeItemName('Huevos')).toBe(normalizeItemName('huevo'));
  });

  it('no confunde productos distintos', () => {
    expect(normalizeItemName('Atún en lata grande')).not.toBe(normalizeItemName('Atún lata pequeno'));
    expect(normalizeItemName('Pan tajado')).not.toBe(normalizeItemName('Pan Hamburguesa'));
  });
});
