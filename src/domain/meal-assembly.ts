import type { MealSlot } from './recipe';
import type { Component, Macros, RoleId } from './component';
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

/** Orden de ajuste del doc: bases/grasas → verduras → proteínas. Gustos y locked nunca se tocan. */
const ADJUST_ORDER: RoleId[] = ['base', 'grasa', 'verdura', 'proteina'];

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export interface AdjustResult {
  meal: AssembledMeal;
  /** Entradas que no pudieron ajustarse más (llegaron a su límite) aunque todavía falte calzar. */
  reachedLimit: string[];
  /** true si no se logró cubrir todo el delta pedido por límites de porción. */
  incomplete: boolean;
}

/**
 * C2: ajusta las cantidades de la comida para acercar `currentKcal` a `targetKcal`, respetando
 * min/max/step de cada componente y sin tocar entradas marcadas "gusto" o con candado (`locked`).
 * Reparte el delta en el orden base/grasa → verdura → proteína, un componente a la vez.
 */
export function adjustMealToFitKcal(
  meal: AssembledMeal,
  components: Component[],
  targetKcal: number
): AdjustResult {
  const componentMap = new Map(components.map((c) => [c.id, c]));
  let entries = meal.entries.map((e) => ({ ...e }));
  const reachedLimit: string[] = [];

  const adjustable = (role: RoleId) =>
    entries.filter((e) => {
      const c = componentMap.get(e.componentId);
      return !!c && !e.locked && !c.isTreat && c.roles.includes(role);
    });

  for (const role of ADJUST_ORDER) {
    let currentKcal = entries.reduce((sum, e) => {
      const c = componentMap.get(e.componentId);
      return c ? sum + macrosForQuantity(c, e.quantity).kcal : sum;
    }, 0);
    let delta = targetKcal - currentKcal;
    if (Math.abs(delta) < 1) continue;

    for (const entry of adjustable(role)) {
      const component = componentMap.get(entry.componentId)!;
      const kcalPerUnit = macrosForQuantity(component, 1).kcal;
      if (kcalPerUnit <= 0) continue;

      const deltaQty = delta / kcalPerUnit;
      let newQty = roundToStep(entry.quantity + deltaQty, component.portion.step);
      const clamped = Math.max(component.portion.min, Math.min(component.portion.max, newQty));
      if (clamped !== newQty) reachedLimit.push(entry.componentId);
      newQty = clamped;

      const appliedDeltaKcal = (newQty - entry.quantity) * kcalPerUnit;
      entry.quantity = newQty;
      delta -= appliedDeltaKcal;
      if (Math.abs(delta) < 1) break;
    }
  }

  const finalKcal = entries.reduce((sum, e) => {
    const c = componentMap.get(e.componentId);
    return c ? sum + macrosForQuantity(c, e.quantity).kcal : sum;
  }, 0);

  return {
    meal: { ...meal, entries, updatedAt: nowIso() },
    reachedLimit,
    incomplete: Math.abs(targetKcal - finalKcal) >= 1,
  };
}
