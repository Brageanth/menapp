import type { Recipe } from './recipe';
import type { NewComponentInput } from './component';

export type MigrationDecision = 'separable' | 'complete-dish' | 'archive';
export type MigrationStatus = 'pending' | 'proposed' | 'applied';

/** Propuesta de un componente nuevo (o referencia a uno existente) para una receta que se separa. */
export interface ProposedComponent {
  /** Si matchea un componente ya existente en la biblioteca, su id — fusionar en vez de duplicar. */
  existingComponentId?: string;
  input?: NewComponentInput;
}

/** Estado de migración de una receta — una por receta, nunca se borra (historial). */
export interface RecipeMigrationRecord {
  id: string;
  recipeId: string;
  status: MigrationStatus;
  decision: MigrationDecision | null;
  proposedComponents: ProposedComponent[];
  note: string;
  reviewedByUser: boolean;
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createPendingMigration(id: string, recipeId: string): RecipeMigrationRecord {
  return {
    id,
    recipeId,
    status: 'pending',
    decision: null,
    proposedComponents: [],
    note: '',
    reviewedByUser: false,
    updatedAt: nowIso(),
  };
}

/** A4: aplica la propuesta (de IA o manual) a un registro pendiente — el usuario todavía debe confirmar. */
export function proposeMigration(
  record: RecipeMigrationRecord,
  decision: MigrationDecision,
  proposedComponents: ProposedComponent[],
  note: string
): RecipeMigrationRecord {
  return { ...record, status: 'proposed', decision, proposedComponents, note, reviewedByUser: false, updatedAt: nowIso() };
}

/** El usuario confirma (editando o no) la propuesta — queda lista para aplicarse. */
export function confirmMigration(record: RecipeMigrationRecord, decision: MigrationDecision, proposedComponents: ProposedComponent[]): RecipeMigrationRecord {
  return { ...record, decision, proposedComponents, reviewedByUser: true, updatedAt: nowIso() };
}

export function markApplied(record: RecipeMigrationRecord): RecipeMigrationRecord {
  if (!record.reviewedByUser) throw new Error('No se puede aplicar una migración sin revisión del usuario.');
  return { ...record, status: 'applied', updatedAt: nowIso() };
}

/**
 * Heurística simple de default (sin IA) para proponer una decisión inicial, editable por el
 * usuario: recetas con pocos ingredientes y sin receta multi-paso compleja se proponen como
 * separables en componentes; recetas con muchos ingredientes/pasos se proponen como plato
 * completo. Nunca es la decisión final — siempre pasa por revisión.
 */
export function heuristicDecision(recipe: Recipe): MigrationDecision {
  if (recipe.ingredients.length <= 3 && recipe.steps.length <= 2) return 'separable';
  return 'complete-dish';
}

export interface MigrationProgress {
  total: number;
  applied: number;
  pending: number;
}

export function migrationProgress(records: RecipeMigrationRecord[]): MigrationProgress {
  return {
    total: records.length,
    applied: records.filter((r) => r.status === 'applied').length,
    pending: records.filter((r) => r.status !== 'applied').length,
  };
}

export function isMigrationComplete(records: RecipeMigrationRecord[], totalRecipes: number): boolean {
  return records.length === totalRecipes && records.every((r) => r.status === 'applied');
}
