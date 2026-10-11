import { describe, expect, it } from 'vitest';
import {
  archiveComponent,
  createComponent,
  filterComponents,
  findDuplicateComponent,
  macrosForQuantity,
  reviseComponent,
  validateNewComponent,
  type Component,
  type NewComponentInput,
} from './component';

function baseInput(overrides: Partial<NewComponentInput> = {}): NewComponentInput {
  return {
    name: 'Pechuga de pollo',
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

describe('validateNewComponent', () => {
  it('pasa con un componente simple válido', () => {
    expect(validateNewComponent(baseInput())).toEqual([]);
  });

  it('exige nombre', () => {
    expect(validateNewComponent(baseInput({ name: '  ' }))).toContain('El nombre es obligatorio.');
  });

  it('exige al menos un rol', () => {
    expect(validateNewComponent(baseInput({ roles: [] }))).toContain('Debe tener al menos un rol.');
  });

  it('rechaza porción típica fuera de rango', () => {
    const errors = validateNewComponent(baseInput({ portion: { typical: 500, min: 100, max: 250, step: 10 } }));
    expect(errors).toContain('La porción típica debe estar entre el mínimo y el máximo.');
  });

  it('exige ingredientes si el origen es preparado', () => {
    const errors = validateNewComponent(baseInput({ origin: 'preparado', ingredients: [] }));
    expect(errors).toContain('Un componente preparado necesita al menos un ingrediente.');
  });

  it('rechaza macros negativos', () => {
    const errors = validateNewComponent(baseInput({ macros: { kcal: -1, protein: 31, carbs: 0, fat: 3.6 } }));
    expect(errors).toContain('Los macros no pueden ser negativos.');
  });
});

describe('createComponent', () => {
  it('crea con version 1 y estado activo', () => {
    const c = createComponent('c1', baseInput());
    expect(c.id).toBe('c1');
    expect(c.version).toBe(1);
    expect(c.status).toBe('active');
  });

  it('lanza si el input es inválido', () => {
    expect(() => createComponent('c1', baseInput({ name: '' }))).toThrow();
  });

  it('crea un componente preparado con receta', () => {
    const c = createComponent(
      'c2',
      baseInput({
        origin: 'preparado',
        ingredients: [{ name: 'arroz', quantity: 200, unit: 'g' }],
        steps: ['Cocinar arroz'],
        batchable: true,
        cookedShelfLifeDays: 4,
      })
    );
    expect(c.origin).toBe('preparado');
    expect(c.ingredients).toHaveLength(1);
  });
});

describe('reviseComponent', () => {
  it('sube la versión al revisar', () => {
    const c = createComponent('c1', baseInput());
    const revised = reviseComponent(c, { name: 'Pechuga de pollo a la plancha' });
    expect(revised.version).toBe(2);
    expect(revised.name).toBe('Pechuga de pollo a la plancha');
  });

  it('valida el resultado final de la revisión', () => {
    const c = createComponent('c1', baseInput());
    expect(() => reviseComponent(c, { roles: [] })).toThrow();
  });
});

describe('archiveComponent', () => {
  it('marca como archivado sin borrar datos', () => {
    const c = createComponent('c1', baseInput());
    const archived = archiveComponent(c);
    expect(archived.status).toBe('archived');
    expect(archived.name).toBe(c.name);
  });
});

describe('filterComponents', () => {
  const active = createComponent('c1', baseInput());
  const archived = archiveComponent(createComponent('c2', baseInput({ name: 'Lentejas', roles: ['proteina'] })));
  const favorite: Component = { ...createComponent('c3', baseInput({ name: 'Aguacate', roles: ['verdura', 'grasa'] })), favorite: true };
  const all = [active, archived, favorite];

  it('oculta archivados por defecto', () => {
    expect(filterComponents(all, {})).toEqual([active, favorite]);
  });

  it('incluye archivados si se pide', () => {
    expect(filterComponents(all, { includeArchived: true })).toHaveLength(3);
  });

  it('filtra por rol', () => {
    expect(filterComponents(all, { role: 'grasa' })).toEqual([favorite]);
  });

  it('filtra por favorito', () => {
    expect(filterComponents(all, { favoriteOnly: true })).toEqual([favorite]);
  });

  it('filtra por texto de búsqueda', () => {
    expect(filterComponents(all, { query: 'agua' })).toEqual([favorite]);
  });
});

describe('macrosForQuantity', () => {
  it('escala per100g correctamente', () => {
    const c = createComponent('c1', baseInput());
    expect(macrosForQuantity(c, 300)).toEqual({ kcal: 495, protein: 93, carbs: 0, fat: 10.8 });
  });

  it('escala perUnit correctamente', () => {
    const c = createComponent(
      'c1',
      baseInput({ macrosBasis: 'perUnit', macros: { kcal: 80, protein: 1, carbs: 20, fat: 0 }, unit: 'unidad' })
    );
    expect(macrosForQuantity(c, 2)).toEqual({ kcal: 160, protein: 2, carbs: 40, fat: 0 });
  });
});

describe('findDuplicateComponent', () => {
  it('detecta duplicados ignorando acentos/mayúsculas/espacios', () => {
    const c = createComponent('c1', baseInput({ name: 'Aguacate' }));
    expect(findDuplicateComponent([c], '  AGUACATÉ ')).toBe(c);
  });

  it('no cuenta archivados como duplicado', () => {
    const c = archiveComponent(createComponent('c1', baseInput({ name: 'Aguacate' })));
    expect(findDuplicateComponent([c], 'Aguacate')).toBeUndefined();
  });
});
