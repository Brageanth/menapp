import type { Component } from './component';
import type { InventoryItem } from './inventory';
import type { ComponentBatch } from './component-batch';
import type { FlavorPair } from './flavor-pair';
import type { ComponentRating } from './component-rating';
import type { MealTemplate } from './meal-template';
import { createDefaultTemplate } from './meal-template';
import type { AssembledMeal, MealComponentEntry } from './meal-assembly';
import { completeMeal } from './meal-compose';
import { sizeMeals, type MacroTarget } from './meal-sizing';
import { recentlyUsedComponentIds } from './suggestion';
import { SLOT_KCAL_WEIGHTS, type MealSlot } from './meal-slot';

export interface WeekPlanAssignment {
  date: string;
  slot: MealSlot;
  entries: MealComponentEntry[];
}

export interface WeekPlanInput {
  dates: string[];
  slots: MealSlot[];
  templates: MealTemplate[];
  components: Component[];
  inventory: InventoryItem[];
  batches: ComponentBatch[];
  flavorPairs: FlavorPair[];
  ratings: ComponentRating[];
  /** Comidas ya existentes (otras semanas) — alimentan la ventana de variedad junto con lo generado en esta corrida. */
  existingMeals: AssembledMeal[];
  /** Meta diaria de macros, o null si no hay meta configurada (porciones típicas sin dimensionar). */
  dailyTarget: MacroTarget | null;
  varietyWindowDays: number;
  now: Date;
}

/**
 * E1/C5 a nivel semana: la versión "Generar menú" sobre componentes. Por cada día: (1) elige qué va en
 * cada comida con el motor de sugerencias, tratando lo ya generado como historial para no repetir
 * (ventana de variedad, 3 días por defecto), y (2) dimensiona las porciones del día completo contra la
 * meta diaria de macros con `sizeMeals`.
 */
export function generateWeekPlan(input: WeekPlanInput): WeekPlanAssignment[] {
  const { dates, slots, templates, components, dailyTarget, varietyWindowDays, now } = input;
  const generatedSoFar: AssembledMeal[] = [];
  const results: WeekPlanAssignment[] = [];

  for (const date of dates) {
    const dayMeals: MealComponentEntry[][] = [];

    for (const slot of slots) {
      const template = templates.find((t) => t.slot === slot) ?? createDefaultTemplate(`default-${slot}`, slot);
      const recentlyUsed = recentlyUsedComponentIds([...input.existingMeals, ...generatedSoFar], date, varietyWindowDays);
      const entries = completeMeal({
        template,
        slot,
        entries: [],
        components,
        inventory: input.inventory,
        batches: input.batches,
        flavorPairs: input.flavorPairs,
        ratings: input.ratings,
        recentlyUsedComponentIds: recentlyUsed,
        slotKcalTarget: dailyTarget?.kcal != null ? dailyTarget.kcal * SLOT_KCAL_WEIGHTS[slot] : null,
        onlyRequired: true,
        now,
      });
      dayMeals.push(entries);
      generatedSoFar.push({ id: `${date}-${slot}`, date, slot, entries, updatedAt: now.toISOString() });
    }

    const sized = dailyTarget ? sizeMeals({ meals: dayMeals, components, target: dailyTarget }).meals : dayMeals;
    slots.forEach((slot, i) => {
      results.push({ date, slot, entries: sized[i] });
      // el historial de variedad solo mira ids, pero dejamos la comida ya dimensionada para coherencia.
      generatedSoFar[generatedSoFar.length - slots.length + i].entries = sized[i];
    });
  }

  return results;
}
