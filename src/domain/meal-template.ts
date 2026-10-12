import type { MealSlot } from './meal-slot';
import type { RoleId } from './component';

/** Un slot dentro de una plantilla de comida: qué rol va ahí y si es obligatorio. */
export interface TemplateSlot {
  id: string;
  role: RoleId;
  required: boolean;
  /** Orden de presentación dentro de la plantilla. */
  order: number;
}

/** B1: plantilla editable por comida (desayuno/almuerzo/cena/onces...). */
export interface MealTemplate {
  id: string;
  slot: MealSlot;
  name: string;
  slots: TemplateSlot[];
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export const DEFAULT_TEMPLATES: Record<MealSlot, Omit<MealTemplate, 'id' | 'updatedAt'>> = {
  D: {
    slot: 'D',
    name: 'Desayuno',
    slots: [
      { id: 'd-proteina', role: 'proteina', required: true, order: 0 },
      { id: 'd-base', role: 'base', required: true, order: 1 },
      { id: 'd-fruta', role: 'fruta', required: false, order: 2 },
      { id: 'd-bebida', role: 'bebida', required: false, order: 3 },
    ],
  },
  M: {
    slot: 'M',
    name: 'Media mañana',
    slots: [{ id: 'm-fruta', role: 'fruta', required: true, order: 0 }],
  },
  A: {
    slot: 'A',
    name: 'Almuerzo',
    slots: [
      { id: 'a-proteina', role: 'proteina', required: true, order: 0 },
      { id: 'a-base', role: 'base', required: true, order: 1 },
      { id: 'a-verdura', role: 'verdura', required: true, order: 2 },
      { id: 'a-salsa', role: 'salsa', required: false, order: 3 },
    ],
  },
  O: {
    slot: 'O',
    name: 'Onces',
    slots: [
      { id: 'o-proteina', role: 'proteina', required: false, order: 0 },
      { id: 'o-fruta', role: 'fruta', required: false, order: 1 },
    ],
  },
  C: {
    slot: 'C',
    name: 'Cena',
    slots: [
      { id: 'c-proteina', role: 'proteina', required: true, order: 0 },
      { id: 'c-verdura', role: 'verdura', required: true, order: 1 },
      { id: 'c-grasa', role: 'grasa', required: false, order: 2 },
    ],
  },
};

export function createDefaultTemplate(id: string, slot: MealSlot): MealTemplate {
  return { ...DEFAULT_TEMPLATES[slot], id, updatedAt: nowIso() };
}

/** B1: edita una plantilla (agregar/quitar/reordenar slots), reescribiendo el `updatedAt`. */
export function updateTemplateSlots(template: MealTemplate, slots: TemplateSlot[]): MealTemplate {
  return { ...template, slots: [...slots].sort((a, b) => a.order - b.order), updatedAt: nowIso() };
}

export function missingRequiredRoles(template: MealTemplate, filledRoles: RoleId[]): RoleId[] {
  const filled = new Set(filledRoles);
  return template.slots.filter((s) => s.required && !filled.has(s.role)).map((s) => s.role);
}
