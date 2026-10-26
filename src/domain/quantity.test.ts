import { describe, expect, it } from 'vitest';
import { canonicalAmount, cleanProductName, nameCovers, convertToUnit, formatAmount, normalizeItemName } from './quantity';

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

describe('cleanProductName', () => {
  it('quita la preparación y conserva mayúsculas y acentos', () => {
    expect(cleanProductName('Brócoli al vapor')).toBe('Brócoli');
    expect(cleanProductName('cebolla picada')).toBe('cebolla');
    expect(cleanProductName('pechuga de pollo en cubos')).toBe('pechuga de pollo');
    expect(cleanProductName('papas en air fryer')).toBe('papas');
    expect(cleanProductName('Guanabana fresca en trozos')).toBe('Guanabana');
    expect(cleanProductName('Mandarina fresca pelada')).toBe('Mandarina');
    expect(cleanProductName('Huevo frito')).toBe('Huevo');
    expect(cleanProductName('Tostada de pan integral')).toBe('pan integral');
    expect(cleanProductName('Raviolis prehechos')).toBe('Raviolis');
  });

  it('no toca productos que llevan esa palabra como parte de su nombre', () => {
    expect(cleanProductName('Queso fresco')).toBe('Queso fresco');
    expect(cleanProductName('pan rallado')).toBe('pan rallado');
    expect(cleanProductName('Carne molida')).toBe('Carne molida');
    expect(cleanProductName('Piña congelada')).toBe('Piña congelada');
  });

  it('si todo el nombre es preparación, deja el original', () => {
    expect(cleanProductName('frito')).toBe('frito');
  });

  it('hace que variantes preparadas coincidan con el producto', () => {
    expect(normalizeItemName('cebolla picada')).toBe(normalizeItemName('Cebolla'));
    expect(normalizeItemName('Tomate guisado')).toBe(normalizeItemName('tomate'));
    expect(normalizeItemName('Mango fresco')).toBe(normalizeItemName('mango'));
  });
});

describe('nameCovers', () => {
  it('una variante más específica cubre el producto', () => {
    expect(nameCovers('Tomate Chonto', 'tomate')).toBe(true);
    expect(nameCovers('Cebolla Blanca', 'cebolla picada')).toBe(true);
    expect(nameCovers('Pechuga pollo', 'pechuga de pollo')).toBe(true);
    expect(nameCovers('Atún lata pequeno', 'atún en lata')).toBe(true);
    expect(nameCovers('Camarón', 'camarones')).toBe(true);
  });

  it('no confunde productos que solo comparten una palabra', () => {
    expect(nameCovers('Salsa de Tomate', 'tomate')).toBe(false);
    expect(nameCovers('Crema de leche', 'leche')).toBe(false);
    expect(nameCovers('Pan Hamburguesa', 'pan integral')).toBe(false);
    expect(nameCovers('Tomate', 'tomate chonto')).toBe(false);
  });
});
