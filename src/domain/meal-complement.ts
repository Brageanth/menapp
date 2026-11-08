import type { Component, RoleId } from './component';
import type { MealComponentEntry } from './meal-assembly';
import type { MacroTarget } from './meal-sizing';
import { sizeMeals } from './meal-sizing';
import type { SuggestionContext } from './suggestion';
import { suggestComponentsForRole } from './suggestion';

/** Cuánto se permite estirar una porción sobre la típica antes de preferir sumar otro componente. */
export const STRETCH_LIMIT = 1.5;
/** Roles que sirven de complemento cuando una comida no llega a la meta sin inflar porciones. */
export const COMPLEMENT_ROLES: RoleId[] = ['fruta', 'lacteo', 'bebida', 'postre'];
const MAX_COMPLEMENTS_PER_MEAL = 2;
/** Por debajo de este % de la meta de kcal se considera que el día queda corto. */
const SHORTFALL_RATIO = 0.9;

function cappedMax(c: Component): number {
  const { typical, min, max, step } = c.portion;
  const limit = typical * STRETCH_LIMIT;
  if (limit >= max) return max;
  const steps = Math.floor((limit - min) / step + 1e-9);
  return Math.max(typical, Math.round((min + steps * step) * 100) / 100);
}

/** Copia de los componentes con la porción máxima limitada a `STRETCH_LIMIT` × típica. */
function withStretchCap(components: Component[]): Component[] {
  return components.map((c) => ({ ...c, portion: { ...c.portion, max: cappedMax(c) } }));
}

type ComplementContext = Omit<SuggestionContext, 'role'>;

/** Mejor complemento (fruta/lácteo/bebida/postre) que la comida todavía no tenga, o null si no hay. */
export function suggestComplement(ctx: ComplementContext, entries: MealComponentEntry[]): Component | null {
  const inMeal = new Set(entries.map((e) => e.componentId));
  let best: { component: Component; score: number } | null = null;
  for (const role of COMPLEMENT_ROLES) {
    const [top] = suggestComponentsForRole({ ...ctx, role }, 1).filter((s) => !inMeal.has(s.component.id));
    if (top && (!best || top.score > best.score)) best = top;
  }
  return best?.component ?? null;
}

export interface SizeDayInput {
  meals: MealComponentEntry[][];
  components: Component[];
  target: MacroTarget;
  /** Contexto de sugerencia para elegir complementos, por comida (mismo índice que `meals`). */
  contextFor: (mealIndex: number) => ComplementContext;
}

/**
 * Dimensiona un día completo contra la meta. Primero con las porciones estiradas como mucho a
 * `STRETCH_LIMIT`; si el día queda corto de kcal y alguna comida ya está al tope, le suma un complemento
 * (hasta 2 por comida) en lugar de agrandar el plato (ej. 2 sándwiches → 1 sándwich + fruta).
 * Sin complementos disponibles, vuelve al ajuste libre de `sizeMeals`.
 */
export function sizeDayWithComplements({ meals, components, target, contextFor }: SizeDayInput): MealComponentEntry[][] {
  const capped = withStretchCap(components);
  const byId = new Map(capped.map((c) => [c.id, c]));
  let result = sizeMeals({ meals, components: capped, target });
  const added = meals.map(() => 0);
  let addedAny = false;

  const isShort = () => target.kcal != null && result.totals.kcal < target.kcal * SHORTFALL_RATIO;
  const atCap = (entries: MealComponentEntry[]) =>
    entries.some((e) => {
      const c = byId.get(e.componentId);
      return c != null && !c.isTreat && !e.locked && e.quantity >= c.portion.max;
    });

  while (isShort()) {
    const idx = result.meals.findIndex((entries, i) => added[i] < MAX_COMPLEMENTS_PER_MEAL && atCap(entries));
    if (idx < 0) break;
    const complement = suggestComplement(contextFor(idx), result.meals[idx]);
    if (!complement) break;
    const next = result.meals.map((entries, i) =>
      i === idx ? [...entries, { componentId: complement.id, quantity: complement.portion.typical, locked: false }] : entries
    );
    added[idx]++;
    addedAny = true;
    result = sizeMeals({ meals: next, components: capped, target });
  }

  return addedAny ? result.meals : sizeMeals({ meals, components, target }).meals;
}
