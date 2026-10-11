import { describe, expect, it } from 'vitest';
import { createDefaultTemplate, missingRequiredRoles, updateTemplateSlots } from './meal-template';

describe('createDefaultTemplate', () => {
  it('crea la plantilla por defecto de almuerzo con roles obligatorios', () => {
    const t = createDefaultTemplate('t1', 'A');
    expect(t.name).toBe('Almuerzo');
    expect(t.slots.map((s) => s.role)).toEqual(['proteina', 'base', 'verdura', 'salsa']);
  });
});

describe('updateTemplateSlots', () => {
  it('reordena los slots por order', () => {
    const t = createDefaultTemplate('t1', 'D');
    const reordered = updateTemplateSlots(t, [
      { id: 'd-fruta', role: 'fruta', required: false, order: 1 },
      { id: 'd-proteina', role: 'proteina', required: true, order: 0 },
    ]);
    expect(reordered.slots.map((s) => s.id)).toEqual(['d-proteina', 'd-fruta']);
  });
});

describe('missingRequiredRoles', () => {
  it('detecta roles obligatorios sin llenar', () => {
    const t = createDefaultTemplate('t1', 'A');
    expect(missingRequiredRoles(t, ['proteina'])).toEqual(['base', 'verdura']);
  });

  it('vacío cuando todos los obligatorios están llenos', () => {
    const t = createDefaultTemplate('t1', 'A');
    expect(missingRequiredRoles(t, ['proteina', 'base', 'verdura'])).toEqual([]);
  });
});
