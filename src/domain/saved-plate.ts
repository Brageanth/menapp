import type { MealSlot } from './recipe';
import type { MealComponentEntry } from './meal-assembly';

export type SavedPlateStatus = 'active' | 'archived';

/** B2: una combinación de componentes guardada como favorita, reutilizable en un tap. */
export interface SavedPlate {
  id: string;
  name: string;
  slot: MealSlot;
  entries: MealComponentEntry[];
  favorite?: boolean;
  status: SavedPlateStatus;
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createSavedPlate(id: string, name: string, slot: MealSlot, entries: MealComponentEntry[]): SavedPlate {
  if (!name.trim()) throw new Error('El nombre del plato es obligatorio.');
  if (entries.length === 0) throw new Error('Un plato guardado necesita al menos un componente.');
  return { id, name: name.trim(), slot, entries, status: 'active', updatedAt: nowIso() };
}

export function archiveSavedPlate(plate: SavedPlate): SavedPlate {
  return { ...plate, status: 'archived', updatedAt: nowIso() };
}

export function renameSavedPlate(plate: SavedPlate, name: string): SavedPlate {
  if (!name.trim()) throw new Error('El nombre del plato es obligatorio.');
  return { ...plate, name: name.trim(), updatedAt: nowIso() };
}

export interface SavedPlateFilter {
  slot?: MealSlot;
  query?: string;
  includeArchived?: boolean;
}

export function filterSavedPlates(plates: SavedPlate[], filter: SavedPlateFilter): SavedPlate[] {
  const q = filter.query?.trim().toLowerCase() ?? '';
  return plates.filter((p) => {
    if (!filter.includeArchived && p.status === 'archived') return false;
    if (filter.slot && p.slot !== filter.slot) return false;
    if (q && !p.name.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Aplica un plato guardado a una comida existente, reemplazando sus entradas por las del plato. */
export function applyPlateToMeal<TMeal extends { entries: MealComponentEntry[]; updatedAt: string }>(
  meal: TMeal,
  plate: SavedPlate
): TMeal {
  return { ...meal, entries: plate.entries.map((e) => ({ ...e })), updatedAt: nowIso() };
}
