import type { RecipeIngredient } from './recipe';

/** Roles iniciales editables por el usuario (semilla) — un componente puede tener varios. */
export type RoleId =
  | 'proteina'
  | 'base'
  | 'verdura'
  | 'fruta'
  | 'lacteo'
  | 'grasa'
  | 'salsa'
  | 'bebida'
  | 'postre';

export const SEED_ROLES: { id: RoleId; label: string }[] = [
  { id: 'proteina', label: 'Proteína' },
  { id: 'base', label: 'Base' },
  { id: 'verdura', label: 'Verdura' },
  { id: 'fruta', label: 'Fruta' },
  { id: 'lacteo', label: 'Lácteo' },
  { id: 'grasa', label: 'Grasa/extra' },
  { id: 'salsa', label: 'Salsa' },
  { id: 'bebida', label: 'Bebida' },
  { id: 'postre', label: 'Postre' },
];

export type ComponentOrigin = 'simple' | 'preparado';
export type WeightState = 'crudo' | 'cocido';
export type MacrosBasis = 'per100g' | 'perUnit';
export type Temperature = 'frio' | 'caliente' | 'ambiente';
export type Effort = 'bajo' | 'medio' | 'alto';
export type ComponentStatus = 'active' | 'archived';

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Portion {
  typical: number;
  min: number;
  max: number;
  step: number;
}

export interface Component {
  id: string;
  name: string;
  roles: RoleId[];
  origin: ComponentOrigin;
  unit: string;
  portion: Portion;
  weightState: WeightState;
  macrosBasis: MacrosBasis;
  macros: Macros;
  isTreat: boolean;
  flavorProfile?: string[];
  temperature?: Temperature;
  effort?: Effort;
  cookedShelfLifeDays?: number;
  batchable?: boolean;
  /** Solo si origin === 'preparado'. */
  ingredients?: RecipeIngredient[];
  steps?: string[];
  /** Plato fuerte completo (ej. lasaña) — cubre varios roles sin descomponerse. */
  isCompleteDish?: boolean;
  favorite?: boolean;
  status: ComponentStatus;
  notes?: string;
  version: number;
  parentComponentId?: string;
  updatedAt: string;
}

export type NewComponentInput = Omit<
  Component,
  'id' | 'status' | 'version' | 'updatedAt'
>;

/** A1: crear componente simple. Falla si falta algo obligatorio o la porción es inconsistente. */
export function validateNewComponent(input: NewComponentInput): string[] {
  const errors: string[] = [];
  if (!input.name?.trim()) errors.push('El nombre es obligatorio.');
  if (!input.roles || input.roles.length === 0) errors.push('Debe tener al menos un rol.');
  if (!input.unit?.trim()) errors.push('La unidad es obligatoria.');
  if (!input.portion) {
    errors.push('La porción es obligatoria.');
  } else {
    const { typical, min, max, step } = input.portion;
    if (min > max) errors.push('La porción mínima no puede ser mayor que la máxima.');
    if (typical < min || typical > max) errors.push('La porción típica debe estar entre el mínimo y el máximo.');
    if (step <= 0) errors.push('El paso de porción debe ser mayor que cero.');
  }
  if (input.origin === 'preparado' && (!input.ingredients || input.ingredients.length === 0)) {
    errors.push('Un componente preparado necesita al menos un ingrediente.');
  }
  if (!input.macros) {
    errors.push('Los macros son obligatorios.');
  } else if (input.macros.kcal < 0 || input.macros.protein < 0 || input.macros.carbs < 0 || input.macros.fat < 0) {
    errors.push('Los macros no pueden ser negativos.');
  }
  return errors;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** A1/A2: crea un componente nuevo (simple o preparado) con id y metadata de versión en 1. */
export function createComponent(id: string, input: NewComponentInput): Component {
  const errors = validateNewComponent(input);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return {
    ...input,
    id,
    status: 'active',
    version: 1,
    updatedAt: nowIso(),
  };
}

/**
 * A3 (cambio en lenguaje natural) y versionado: aplica cambios sobre un componente existente,
 * subiendo la versión. El componente previo no se borra — queda como historial implícito por el
 * caller via `parentComponentId` si decide clonar en vez de mutar.
 */
export function reviseComponent(current: Component, changes: Partial<NewComponentInput>): Component {
  const next: Component = { ...current, ...changes, version: current.version + 1, updatedAt: nowIso() };
  const errors = validateNewComponent(next);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return next;
}

export function archiveComponent(current: Component): Component {
  return { ...current, status: 'archived', updatedAt: nowIso() };
}

export interface ComponentFilter {
  query?: string;
  role?: RoleId;
  favoriteOnly?: boolean;
  includeArchived?: boolean;
}

/** A5: buscar/filtrar componentes. Archivados ocultos por defecto (visibles solo si se pide). */
export function filterComponents(components: Component[], filter: ComponentFilter): Component[] {
  const q = filter.query?.trim().toLowerCase() ?? '';
  return components.filter((c) => {
    if (!filter.includeArchived && c.status === 'archived') return false;
    if (filter.role && !c.roles.includes(filter.role)) return false;
    if (filter.favoriteOnly && !c.favorite) return false;
    if (q && !c.name.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Macros efectivos de `component` para una cantidad dada en su unidad declarada. */
export function macrosForQuantity(component: Component, quantity: number): Macros {
  const factor = component.macrosBasis === 'per100g' ? quantity / 100 : quantity;
  return {
    kcal: component.macros.kcal * factor,
    protein: component.macros.protein * factor,
    carbs: component.macros.carbs * factor,
    fat: component.macros.fat * factor,
  };
}

/** Detección simple de duplicados por nombre normalizado (acentos/mayúsculas/espacios). */
export function normalizeNameForDuplicateCheck(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

export function findDuplicateComponent(components: Component[], name: string): Component | undefined {
  const normalized = normalizeNameForDuplicateCheck(name);
  return components.find((c) => normalizeNameForDuplicateCheck(c.name) === normalized && c.status === 'active');
}
