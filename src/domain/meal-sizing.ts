import type { Component, Macros } from './component';
import { macrosForQuantity } from './component';
import type { MealComponentEntry } from './meal-assembly';

/** Meta de macros a cumplir. null = ese macro no se persigue. `protein` es un piso, el resto es un objetivo. */
export interface MacroTarget {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface SizeInput {
  /** Una lista de entradas por comida; todas se dimensionan juntas contra `target` (el día, normalmente). */
  meals: MealComponentEntry[][];
  components: Component[];
  target: MacroTarget;
  /** Macros ya consumidos que no se pueden mover (otras comidas del día, comidas libres). */
  fixed?: Macros;
}

export interface SizeResult {
  meals: MealComponentEntry[][];
  totals: Macros;
  /** componentIds que terminaron pegados a su mínimo/máximo de porción. */
  atLimit: string[];
}

const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

/** Cuánto pesa en el costo alejarse de cada meta (relativo al valor de la meta). */
const WEIGHT = { kcal: 4, protein: 3, carbs: 1, fat: 1 };
/** Tope blando de proteína sobre el piso: pasarse un poco no cuesta, pasarse mucho sí. */
const PROTEIN_CAP = 1.15;
const PROTEIN_OVER_WEIGHT = 0.5;
/** Qué tanto cuesta irse de la porción típica — es lo que frena las porciones gigantes. */
const PORTION_WEIGHT = 0.2;
const MAX_PASSES = 12;

function relSq(value: number, target: number): number {
  const d = (value - target) / Math.max(target, 1);
  return d * d;
}

function macroCost(t: Macros, target: MacroTarget): number {
  let cost = 0;
  if (target.kcal != null) cost += WEIGHT.kcal * relSq(t.kcal, target.kcal);
  if (target.carbs != null) cost += WEIGHT.carbs * relSq(t.carbs, target.carbs);
  if (target.fat != null) cost += WEIGHT.fat * relSq(t.fat, target.fat);
  if (target.protein != null) {
    if (t.protein < target.protein) cost += WEIGHT.protein * relSq(t.protein, target.protein);
    else if (t.protein > target.protein * PROTEIN_CAP) cost += PROTEIN_OVER_WEIGHT * relSq(t.protein, target.protein * PROTEIN_CAP);
  }
  return cost;
}

function candidateQuantities(c: Component): number[] {
  const { min, max, step } = c.portion;
  const out: number[] = [];
  for (let q = min; q <= max + 1e-9 && out.length < 400; q += step) out.push(Math.round(q * 100) / 100);
  return out.length > 0 ? out : [c.portion.typical];
}

/**
 * Dimensiona las cantidades para acercar los macros TOTALES (no los de cada plato) a la meta, sin salirse
 * del rango min/max/paso de cada componente. Es una búsqueda por coordenadas: para cada entrada probar
 * todas las porciones válidas y quedarse con la de menor costo, repetir hasta que nada mejore. El costo
 * suma el error relativo de kcal/proteína/carbs/grasa más un término que penaliza alejarse de la porción
 * típica — así se cumple la meta repartiendo el ajuste en varios componentes en vez de inflar uno.
 * Nunca toca entradas con candado ni gustos (`isTreat`); esas cuentan como macros fijos.
 */
export function sizeMeals({ meals, components, target, fixed = ZERO }: SizeInput): SizeResult {
  const byId = new Map(components.map((c) => [c.id, c]));
  const next = meals.map((entries) => entries.map((e) => ({ ...e })));

  const fixedTotals: Macros = { ...fixed };
  const adjustable: { entry: MealComponentEntry; component: Component; options: number[] }[] = [];
  for (const entry of next.flat()) {
    const component = byId.get(entry.componentId);
    if (!component) continue;
    if (entry.locked || component.isTreat) {
      const m = macrosForQuantity(component, entry.quantity);
      fixedTotals.kcal += m.kcal;
      fixedTotals.protein += m.protein;
      fixedTotals.carbs += m.carbs;
      fixedTotals.fat += m.fat;
    } else {
      adjustable.push({ entry, component, options: candidateQuantities(component) });
    }
  }

  const totalsNow = (): Macros => {
    const t = { ...fixedTotals };
    for (const { entry, component } of adjustable) {
      const m = macrosForQuantity(component, entry.quantity);
      t.kcal += m.kcal;
      t.protein += m.protein;
      t.carbs += m.carbs;
      t.fat += m.fat;
    }
    return t;
  };

  const portionCost = (c: Component, q: number) => PORTION_WEIGHT * relSq(q, c.portion.typical);

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false;
    for (const item of adjustable) {
      const others = totalsNow();
      const own = macrosForQuantity(item.component, item.entry.quantity);
      others.kcal -= own.kcal;
      others.protein -= own.protein;
      others.carbs -= own.carbs;
      others.fat -= own.fat;

      let best = item.entry.quantity;
      let bestCost = Infinity;
      for (const q of item.options) {
        const m = macrosForQuantity(item.component, q);
        const cost =
          macroCost(
            { kcal: others.kcal + m.kcal, protein: others.protein + m.protein, carbs: others.carbs + m.carbs, fat: others.fat + m.fat },
            target
          ) + portionCost(item.component, q);
        if (cost < bestCost - 1e-9) {
          bestCost = cost;
          best = q;
        }
      }
      if (best !== item.entry.quantity) {
        item.entry.quantity = best;
        changed = true;
      }
    }
    if (!changed) break;
  }

  const atLimit = adjustable
    .filter(({ entry, component }) => entry.quantity <= component.portion.min || entry.quantity >= component.portion.max)
    .map(({ entry }) => entry.componentId);

  return { meals: next, totals: totalsNow(), atLimit };
}
