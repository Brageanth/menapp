import type { Component } from './component';
import type { InventoryItem } from './inventory';
import type { ComponentBatch } from './component-batch';
import type { FlavorPair } from './flavor-pair';
import type { ComponentRating } from './component-rating';
import type { MealTemplate } from './meal-template';
import { createDefaultTemplate } from './meal-template';
import type { AssembledMeal, MealComponentEntry } from './meal-assembly';
import { macrosForQuantity } from './component';
import { recentlyUsedComponentIds, suggestComponentsForRole } from './suggestion';
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
  /** kcal diarias objetivo, o null si no hay meta configurada. */
  dailyKcalTarget: number | null;
  varietyWindowDays: number;
  now: Date;
}

/**
 * E1/C5 a nivel semana: la versión "Generar menú" sobre componentes. Recorre cada día/slot en
 * orden y completa los roles obligatorios de la plantilla con el motor de sugerencias, tratando
 * lo ya generado en esta misma corrida como historial para que un día no repita lo del anterior
 * (misma ventana de variedad que en Armar, por defecto 3 días).
 */
export function generateWeekPlan(input: WeekPlanInput): WeekPlanAssignment[] {
  const { dates, slots, templates, components, inventory, batches, flavorPairs, ratings, dailyKcalTarget, varietyWindowDays, now } = input;
  const generatedSoFar: AssembledMeal[] = [];
  const results: WeekPlanAssignment[] = [];

  for (const date of dates) {
    for (const slot of slots) {
      const template = templates.find((t) => t.slot === slot) ?? createDefaultTemplate(`default-${slot}`, slot);
      const slotKcalTarget = dailyKcalTarget != null ? dailyKcalTarget * SLOT_KCAL_WEIGHTS[slot] : null;
      const entries: MealComponentEntry[] = [];
      const allMealsForVariety = [...input.existingMeals, ...generatedSoFar];
      const recentlyUsed = recentlyUsedComponentIds(allMealsForVariety, date, varietyWindowDays);

      for (const ts of template.slots) {
        // Si un componente ya puesto en esta comida cubre este rol (ej. un plato tipo "pasta
        // carbonara" con roles base+proteina+lacteo), no sumar otro componente para el mismo
        // rol — evita terminar con dos platos tipo "base" juntos en la misma comida.
        const roleAlreadyCovered = entries.some((e) => {
          const c = components.find((comp) => comp.id === e.componentId);
          return c?.roles.includes(ts.role);
        });
        if (roleAlreadyCovered) continue;

        const macrosSoFar = entries.reduce((sum, e) => {
          const c = components.find((comp) => comp.id === e.componentId);
          return c ? sum + macrosForQuantity(c, e.quantity).kcal : sum;
        }, 0);
        const remainingKcal = slotKcalTarget != null ? slotKcalTarget - macrosSoFar : null;

        const [top] = suggestComponentsForRole({
          role: ts.role,
          slot,
          candidates: components,
          inventory,
          batches,
          flavorPairs,
          ratings,
          recentlyUsedComponentIds: recentlyUsed,
          alreadyInMeal: entries.map((e) => e.componentId),
          remainingKcal,
          now,
        });
        if (top) entries.push({ componentId: top.component.id, quantity: top.component.portion.typical, locked: false });
      }

      results.push({ date, slot, entries });
      generatedSoFar.push({ id: `${date}-${slot}`, date, slot, entries, updatedAt: now.toISOString() });
    }
  }

  return results;
}
