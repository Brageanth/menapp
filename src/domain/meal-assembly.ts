import type { MealSlot } from './meal-slot';
import type { Component, Macros } from './component';
import { macrosForQuantity } from './component';

export interface MealComponentEntry {
  componentId: string;
  quantity: number;
  /** Candado: el ajuste automático nunca puede tocar esta entrada. */
  locked: boolean;
}

/** C1/C3: una comida armada para una fecha/slot — a mano, con componentes, o libre (fuera de casa). */
export interface AssembledMeal {
  id: string;
  date: string;
  slot: MealSlot;
  entries: MealComponentEntry[];
  /** C3: comida libre/fuera de casa, estimada (por IA u a mano) en vez de armada por componentes. */
  isFreeMeal?: boolean;
  freeMealDescription?: string;
  freeMealEstimatedMacros?: Macros;
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createAssembledMeal(id: string, date: string, slot: MealSlot): AssembledMeal {
  return { id, date, slot, entries: [], updatedAt: nowIso() };
}

/** C3: registra una comida libre (fuera de casa) con macros estimados en vez de componentes. */
export function registerFreeMeal(
  id: string,
  date: string,
  slot: MealSlot,
  description: string,
  estimatedMacros: Macros
): AssembledMeal {
  return {
    id,
    date,
    slot,
    entries: [],
    isFreeMeal: true,
    freeMealDescription: description,
    freeMealEstimatedMacros: estimatedMacros,
    updatedAt: nowIso(),
  };
}

/** C1: agrega o actualiza la cantidad de un componente en la comida. */
export function setEntry(meal: AssembledMeal, componentId: string, quantity: number, locked = false): AssembledMeal {
  const entries = meal.entries.filter((e) => e.componentId !== componentId);
  entries.push({ componentId, quantity, locked });
  return { ...meal, entries, updatedAt: nowIso() };
}

export function removeEntry(meal: AssembledMeal, componentId: string): AssembledMeal {
  return { ...meal, entries: meal.entries.filter((e) => e.componentId !== componentId), updatedAt: nowIso() };
}

export function toggleLock(meal: AssembledMeal, componentId: string, locked: boolean): AssembledMeal {
  return {
    ...meal,
    entries: meal.entries.map((e) => (e.componentId === componentId ? { ...e, locked } : e)),
    updatedAt: nowIso(),
  };
}

/** Suma de macros de la comida: componentes por cantidad, o estimado si es comida libre. */
export function mealMacros(meal: AssembledMeal, components: Component[]): Macros {
  if (meal.isFreeMeal) return meal.freeMealEstimatedMacros ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const componentMap = new Map(components.map((c) => [c.id, c]));
  const totals: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const entry of meal.entries) {
    const component = componentMap.get(entry.componentId);
    if (!component) continue;
    const m = macrosForQuantity(component, entry.quantity);
    totals.kcal += m.kcal;
    totals.protein += m.protein;
    totals.carbs += m.carbs;
    totals.fat += m.fat;
  }
  return totals;
}

/** C4: copia las entradas de una comida a otra fecha/slot (repetir un día o una comida puntual). */
export function copyMeal(meal: AssembledMeal, newId: string, newDate: string, newSlot: MealSlot = meal.slot): AssembledMeal {
  return {
    id: newId,
    date: newDate,
    slot: newSlot,
    entries: meal.entries.map((e) => ({ ...e })),
    isFreeMeal: meal.isFreeMeal,
    freeMealDescription: meal.freeMealDescription,
    freeMealEstimatedMacros: meal.freeMealEstimatedMacros,
    updatedAt: nowIso(),
  };
}
