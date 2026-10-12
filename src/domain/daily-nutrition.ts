import { ALL_SLOTS, SLOT_KCAL_WEIGHTS } from './meal-slot';
import type { AssembledMeal } from './meal-assembly';
import { mealMacros } from './meal-assembly';
import type { Component, Macros } from './component';

export interface DailyNutritionTotals extends Macros {
  /** false si ningún slot del día tiene algo armado con datos — no hay nada que mostrar. */
  hasData: boolean;
  /** Fracción (0-1) del día cubierta por slots con algo armado — se usa para prorratear la meta. */
  coveredFraction: number;
  /** Slots sin nada armado (o armados pero sin componentes) — no suman al total. */
  slotsWithoutData: number;
}

/** Totales de macros del día a partir de lo armado con componentes (Armar) para esa fecha. */
export function dailyNutritionFromMeals(mealsToday: AssembledMeal[], components: Component[]): DailyNutritionTotals {
  const totals: DailyNutritionTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0, hasData: false, coveredFraction: 0, slotsWithoutData: 0 };

  for (const slot of ALL_SLOTS) {
    const meal = mealsToday.find((m) => m.slot === slot);
    const hasContent = meal ? (meal.isFreeMeal ? true : meal.entries.length > 0) : false;
    if (!meal || !hasContent) {
      totals.slotsWithoutData += 1;
      continue;
    }
    const macros = mealMacros(meal, components);
    totals.kcal += macros.kcal;
    totals.protein += macros.protein;
    totals.carbs += macros.carbs;
    totals.fat += macros.fat;
    totals.hasData = true;
    totals.coveredFraction = Math.min(1, totals.coveredFraction + SLOT_KCAL_WEIGHTS[slot]);
  }

  return totals;
}
