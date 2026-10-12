import type { Component } from './component';
import type { AssembledMeal } from './meal-assembly';
import { macrosForQuantity } from './component';
import type { MacroStatus } from './macro-goal';

export type TreatBudgetPeriod = 'daily' | 'weekly';

/** D4: presupuesto de gustos — se aparta antes de calcular el resto, nunca un "no te pases". */
export interface TreatBudget {
  period: TreatBudgetPeriod;
  kcalAmount: number;
}

/**
 * kcal consumidas en componentes marcados "gusto" dentro de las comidas dadas. Bebidas sin
 * calorías (kcal 0) no restan presupuesto porque simplemente no suman nada.
 */
export function treatKcalSpent(meals: AssembledMeal[], components: Component[]): number {
  const componentMap = new Map(components.map((c) => [c.id, c]));
  let spent = 0;
  for (const meal of meals) {
    if (meal.isFreeMeal) continue;
    for (const entry of meal.entries) {
      const component = componentMap.get(entry.componentId);
      if (!component?.isTreat) continue;
      spent += macrosForQuantity(component, entry.quantity).kcal;
    }
  }
  return spent;
}

/**
 * Estado del presupuesto de gustos: es un tope, no un piso — "cerca" cuando falta poco margen,
 * "fuera" solo lejos por encima. Lenguaje neutro en la UI, nunca "te excediste".
 */
export function treatBudgetStatus(spentKcal: number, budget: TreatBudget): MacroStatus {
  if (budget.kcalAmount <= 0) return spentKcal > 0 ? 'fuera' : 'dentro';
  const ratio = spentKcal / budget.kcalAmount;
  if (ratio <= 1) return 'dentro';
  if (ratio <= 1.15) return 'cerca';
  return 'fuera';
}

export function remainingTreatKcal(spentKcal: number, budget: TreatBudget): number {
  return Math.max(0, budget.kcalAmount - spentKcal);
}
