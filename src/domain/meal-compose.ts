import type { Component } from './component';
import { effectiveCoverage, macrosForQuantity } from './component';
import type { InventoryItem } from './inventory';
import type { ComponentBatch } from './component-batch';
import type { FlavorPair } from './flavor-pair';
import type { ComponentRating } from './component-rating';
import type { MealTemplate, TemplateSlot } from './meal-template';
import type { MealComponentEntry } from './meal-assembly';
import type { MealSlot } from './meal-slot';
import { suggestComponentsForRole } from './suggestion';

export interface CompleteMealInput {
  template: MealTemplate;
  slot: MealSlot;
  /** Lo que la comida ya tiene — se conserva tal cual, solo se agregan los roles que faltan. */
  entries: MealComponentEntry[];
  components: Component[];
  inventory: InventoryItem[];
  batches: ComponentBatch[];
  flavorPairs: FlavorPair[];
  ratings: ComponentRating[];
  recentlyUsedComponentIds: Set<string>;
  /** kcal de esta comida según la meta, o null si no hay meta. */
  slotKcalTarget: number | null;
  /** true = solo roles obligatorios de la plantilla, o el primero si no hay ninguno (Generar semana); false = todos (Completar). */
  onlyRequired: boolean;
  now: Date;
}

/**
 * Completa una comida con el top-1 del motor de sugerencias por cada rol de la plantilla que todavía
 * no está cubierto (un componente que ya cubre el rol — `effectiveCoverage` — evita sumar otro).
 * Elige QUÉ va en la comida con porciones típicas; cuánto de cada cosa lo decide `sizeMeals`.
 */
export function completeMeal(input: CompleteMealInput): MealComponentEntry[] {
  const { template, slot, components, slotKcalTarget, onlyRequired } = input;
  const byId = new Map(components.map((c) => [c.id, c]));
  const entries = [...input.entries];

  // Una comida sin ningún rol obligatorio (ej. onces: proteína y fruta opcionales) no puede quedar
  // vacía al generar: el primer rol de la plantilla hace de obligatorio.
  const firstSlotId = [...template.slots].sort((a, b) => a.order - b.order)[0]?.id;
  const hasRequired = template.slots.some((s) => s.required);

  for (const ts of template.slots) {
    if (onlyRequired && !ts.required && (hasRequired || ts.id !== firstSlotId)) continue;
    const covered = entries.some((e) => {
      const c = byId.get(e.componentId);
      return c ? effectiveCoverage(c).includes(ts.role) : false;
    });
    if (covered) continue;

    const kcalSoFar = entries.reduce((sum, e) => {
      const c = byId.get(e.componentId);
      return c ? sum + macrosForQuantity(c, e.quantity).kcal : sum;
    }, 0);

    const [top] = suggestComponentsForRole({
      role: ts.role,
      slot,
      candidates: components,
      inventory: input.inventory,
      batches: input.batches,
      flavorPairs: input.flavorPairs,
      ratings: input.ratings,
      recentlyUsedComponentIds: input.recentlyUsedComponentIds,
      alreadyInMeal: entries.map((e) => e.componentId),
      remainingKcal: slotKcalTarget != null ? slotKcalTarget - kcalSoFar : null,
      now: input.now,
    });
    if (top) entries.push({ componentId: top.component.id, quantity: top.component.portion.typical, locked: false });
  }
  return entries;
}

export interface TemplateGroup {
  slotId: string;
  role: TemplateSlot['role'];
  required: boolean;
  entries: MealComponentEntry[];
}

/**
 * Reparte las entradas entre los slots de la plantilla, cada una en UN solo slot (el primero cuyo rol
 * tenga el componente en `roles`). Lo que no calza con ningún slot va a `other` — nunca se esconde:
 * cuenta en los macros aunque la plantilla no tenga su rol.
 */
export function groupEntriesByTemplate(
  template: MealTemplate,
  entries: MealComponentEntry[],
  components: Component[]
): { groups: TemplateGroup[]; other: MealComponentEntry[] } {
  const byId = new Map(components.map((c) => [c.id, c]));
  const groups: TemplateGroup[] = template.slots.map((ts) => ({ slotId: ts.id, role: ts.role, required: ts.required, entries: [] }));
  const other: MealComponentEntry[] = [];
  for (const entry of entries) {
    const c = byId.get(entry.componentId);
    const group = c ? groups.find((g) => c.roles.includes(g.role)) : undefined;
    if (group) group.entries.push(entry);
    else other.push(entry);
  }
  return { groups, other };
}
