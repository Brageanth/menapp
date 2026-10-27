import type { Component } from './component';
import type { InventoryItem } from './inventory';
import type { ComponentBatch } from './component-batch';
import type { FlavorPair } from './flavor-pair';
import type { ComponentRating } from './component-rating';
import type { MealTemplate } from './meal-template';
import type { MealComponentEntry } from './meal-assembly';
import type { MealSlot } from './meal-slot';
import { completeMeal } from './meal-compose';
import { isComponentAvailable } from './suggestion';

export interface RerollInput {
  template: MealTemplate;
  slot: MealSlot;
  /** La comida tal como está ahora — lo que tenga candado se conserva, lo demás se vuelve a elegir. */
  entries: MealComponentEntry[];
  components: Component[];
  inventory: InventoryItem[];
  batches: ComponentBatch[];
  flavorPairs: FlavorPair[];
  ratings: ComponentRating[];
  /** Ventana de variedad habitual (últimos días) — igual que al generar el menú. */
  recentlyUsedComponentIds: Set<string>;
  /** Componentes que ya salieron en tiradas anteriores de esta misma comida: no se repiten hasta agotar opciones. */
  alreadyTriedIds: Set<string>;
  slotKcalTarget: number | null;
  /** true = solo platos que se pueden hacer con la despensa y los lotes; los roles sin opción así se llenan igual (mejor un plato con algo por comprar que uno incompleto). */
  onlyInStock: boolean;
  now: Date;
}

export interface RerollResult {
  entries: MealComponentEntry[];
  /** false = no había nada distinto que ofrecer (todas las opciones ya salieron o no hay más candidatos). */
  changed: boolean;
}

/**
 * "Rollear" una sola comida: vuelve a armarla con el mismo motor de Generar menú (plantilla, slot,
 * macros, ratings, sabores, variedad), pero empujando al fondo lo que ya está puesto y lo que ya salió
 * en tiradas anteriores. Es una penalización y no un descarte: un rol con una única opción la conserva
 * en vez de quedar vacío. Los candados se respetan.
 */
export function rerollMeal(input: RerollInput): RerollResult {
  const locked = input.entries.filter((e) => e.locked);
  const lockedIds = new Set(locked.map((e) => e.componentId));
  const currentFree = input.entries.filter((e) => !e.locked).map((e) => e.componentId);

  const avoid = new Set([...input.recentlyUsedComponentIds, ...input.alreadyTriedIds, ...currentFree]);
  const compose = (entries: MealComponentEntry[], components: Component[]) =>
    completeMeal({
      template: input.template,
      slot: input.slot,
      entries,
      components,
      inventory: input.inventory,
      batches: input.batches,
      flavorPairs: input.flavorPairs,
      ratings: input.ratings,
      recentlyUsedComponentIds: avoid,
      slotKcalTarget: input.slotKcalTarget,
      onlyRequired: true,
      now: input.now,
    });

  let entries: MealComponentEntry[];
  if (input.onlyInStock) {
    const available = input.components.filter(
      (c) => lockedIds.has(c.id) || isComponentAvailable(c, input.inventory, input.batches, input.now)
    );
    entries = compose(compose(locked, available), input.components);
  } else {
    entries = compose(locked, input.components);
  }

  const next = entries.filter((e) => !e.locked).map((e) => e.componentId).sort().join('|');
  const before = [...currentFree].sort().join('|');
  return { entries, changed: next !== before };
}
