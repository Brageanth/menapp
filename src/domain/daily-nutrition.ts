import type { MenuDay } from './menu';
import type { Recipe } from './recipe';
import { dailyNutritionForProfile, type DailyNutritionTotals } from './recipe';
import { SLOT_KCAL_WEIGHTS, type MealSlot } from './recipe';
import type { Profile } from './profile';
import type { AssembledMeal } from './meal-assembly';
import { mealMacros } from './meal-assembly';
import type { Component } from './component';

/**
 * Combina los totales de macros del día desde los dos sistemas que pueden tener algo asignado
 * para una fecha: el menú de recetas (legacy) y las comidas armadas con componentes (Armar). Un
 * slot nunca se cuenta dos veces: si ya tiene una receta con macros cargados, el componente de ese
 * mismo slot no se suma encima — evita inflar el total si alguna vez quedan los dos a la vez.
 */
export function combinedDailyNutrition(
  menuDaysToday: MenuDay[],
  recipes: Recipe[],
  profile: Profile,
  mealsToday: AssembledMeal[],
  components: Component[]
): DailyNutritionTotals {
  const base = dailyNutritionForProfile(menuDaysToday, recipes, profile);

  const coveredSlots = new Set<MealSlot>();
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  for (const day of menuDaysToday) {
    const recipe = day.recipeId ? recipeMap.get(day.recipeId) : null;
    if (recipe?.caloriesPerServing) coveredSlots.add(day.slot);
  }

  let { kcal, protein, carbs, fat, hasData, coveredFraction } = base;

  for (const meal of mealsToday) {
    if (coveredSlots.has(meal.slot)) continue;
    const hasContent = meal.isFreeMeal ? true : meal.entries.length > 0;
    if (!hasContent) continue;

    const macros = mealMacros(meal, components);
    kcal += macros.kcal;
    protein += macros.protein;
    carbs += macros.carbs;
    fat += macros.fat;
    hasData = true;
    coveredSlots.add(meal.slot);
    coveredFraction = Math.min(1, coveredFraction + SLOT_KCAL_WEIGHTS[meal.slot]);
  }

  return { kcal, protein, carbs, fat, hasData, coveredFraction, slotsWithoutData: base.slotsWithoutData };
}
