import { describe, expect, it } from 'vitest';
import {
  addToInventory,
  consolidateGroup,
  findDuplicateGroups,
  isLowStock,
  stockAvailable,
  type InventoryItem,
} from './inventory';

function item(overrides: Partial<InventoryItem>): InventoryItem {
  return { id: 'i1', name: 'Camarón', quantity: 1, unit: 'g', location: 'nevera', expiresAt: null, updatedAt: '', ...overrides };
}

describe('addToInventory', () => {
  it('suma al mismo producto aunque cambie plural, acento y unidad', () => {
    const existing = item({ id: 'a', name: 'Camarón', quantity: 0.2, unit: 'Kg' });
    const { item: result, merged } = addToInventory([existing], item({ id: 'b', name: 'camarones', quantity: 500, unit: 'g', location: 'alacena' }));
    expect(merged).toBe(true);
    expect(result).toMatchObject({ id: 'a', quantity: 700, unit: 'g', location: 'nevera' });
  });

  it('conserva el vencimiento más cercano', () => {
    const existing = item({ expiresAt: '2026-11-10' });
    const { item: result } = addToInventory([existing], item({ id: 'b', quantity: 1, expiresAt: '2026-11-02' }));
    expect(result.expiresAt).toBe('2026-11-02');
  });

  it('crea un item nuevo si es otro producto', () => {
    const { merged } = addToInventory([item({ name: 'Tilapia' })], item({ id: 'b', name: 'Camarón' }));
    expect(merged).toBe(false);
  });

  it('no suma unidades con gramos sin peso por unidad, pero sí con él', () => {
    const aguacates = item({ name: 'Aguacate', quantity: 3, unit: 'unidad' });
    const bolsa = item({ id: 'b', name: 'Aguacate', quantity: 400, unit: 'g' });
    expect(addToInventory([aguacates], bolsa).merged).toBe(false);

    const { item: result, merged } = addToInventory([{ ...aguacates, unitWeight: 200 }], bolsa);
    expect(merged).toBe(true);
    expect(result).toMatchObject({ quantity: 5, unit: 'unidad', unitWeight: 200 });
  });
});

describe('findDuplicateGroups / consolidateGroup', () => {
  it('agrupa solo lo que se puede sumar y lo junta en una fila', () => {
    const items = [
      item({ id: 'a', name: 'Camarón', quantity: 0.2, unit: 'Kg' }),
      item({ id: 'b', name: 'Camarones', quantity: 300, unit: 'g' }),
      item({ id: 'c', name: 'Tilapia', quantity: 900 }),
    ];
    const groups = findDuplicateGroups(items);
    expect(groups).toHaveLength(1);
    expect(consolidateGroup(groups[0])).toMatchObject({ id: 'a', quantity: 500, unit: 'g' });
  });
});

describe('stockAvailable', () => {
  const stock = [item({ name: 'Pollo', quantity: 1.2, unit: 'Kg' }), item({ id: 'b', name: 'pollo', quantity: 300, unit: 'g' })];

  it('suma todas las filas en la unidad pedida', () => {
    expect(stockAvailable(stock, 'Pollo', 'g')).toBe(1500);
  });

  it('0 si no hay, null si hay pero no es comparable', () => {
    expect(stockAvailable(stock, 'Arroz', 'g')).toBe(0);
    expect(stockAvailable([item({ name: 'Atún', quantity: 3, unit: 'unidad' })], 'Atún', 'g')).toBeNull();
  });
});

describe('isLowStock', () => {
  it('solo aplica a conteos', () => {
    expect(isLowStock(item({ quantity: 1, unit: 'unidad' }), 1)).toBe(true);
    expect(isLowStock(item({ quantity: 0.2, unit: 'Kg' }), 1)).toBe(false);
  });
});
