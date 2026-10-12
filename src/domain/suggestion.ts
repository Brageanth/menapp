import type { Component, RoleId } from './component';
import { macrosForQuantity } from './component';
import type { InventoryItem } from './inventory';
import { isExpiringSoon } from './inventory';
import type { ComponentBatch } from './component-batch';
import { usableBatchesForComponent } from './component-batch';
import type { FlavorPair } from './flavor-pair';
import { relationBetween } from './flavor-pair';
import type { ComponentRating } from './component-rating';
import { ratingScore } from './component-rating';
import type { AssembledMeal } from './meal-assembly';

export interface SuggestionContext {
  role: RoleId;
  candidates: Component[];
  inventory: InventoryItem[];
  batches: ComponentBatch[];
  flavorPairs: FlavorPair[];
  ratings: ComponentRating[];
  /** ids ya usados dentro de la ventana de variedad (por defecto 3 días, ver `recentlyUsedComponentIds`). */
  recentlyUsedComponentIds: Set<string>;
  /** ids ya puestos en la misma comida — para chequear compatibilidad de sabor. */
  alreadyInMeal: string[];
  /** kcal que todavía faltan para el presupuesto de la comida/slot, o null si no hay meta. */
  remainingKcal: number | null;
  now: Date;
}

export interface Suggestion {
  component: Component;
  score: number;
  reason: string;
}

function hasStock(component: Component, inventory: InventoryItem[]): boolean {
  const stock = inventory.find((i) => i.name.toLowerCase().trim() === component.name.toLowerCase().trim());
  return !!stock && stock.quantity >= component.portion.typical;
}

function hasExpiringStock(component: Component, inventory: InventoryItem[], now: Date): boolean {
  const stock = inventory.find((i) => i.name.toLowerCase().trim() === component.name.toLowerCase().trim());
  return !!stock && isExpiringSoon(stock, now);
}

function macroFitScore(component: Component, remainingKcal: number | null): number {
  if (remainingKcal === null) return 0;
  const kcalPerTypical = macrosForQuantity(component, component.portion.typical).kcal;
  const diff = Math.abs(remainingKcal - kcalPerTypical);
  return Math.max(0, 100 - diff / 5);
}

/**
 * E1-E3: puntúa y ordena los componentes candidatos a un rol, con la prioridad del doc:
 * vencimiento → macros faltantes → existencias → compatibilidad de sabor → variedad → esfuerzo.
 * Un "evitar" explícito descarta el candidato por completo, nunca solo lo penaliza.
 */
export function suggestComponentsForRole(ctx: SuggestionContext, limit = 3): Suggestion[] {
  const scored: Suggestion[] = [];

  for (const component of ctx.candidates) {
    if (!component.roles.includes(ctx.role) || component.status !== 'active') continue;

    const avoided = ctx.alreadyInMeal.some((otherId) => relationBetween(ctx.flavorPairs, component.id, otherId) === 'evitar');
    if (avoided) continue;

    const expiring = hasExpiringStock(component, ctx.inventory, ctx.now);
    const macroFit = macroFitScore(component, ctx.remainingKcal);
    const inStock = hasStock(component, ctx.inventory) || usableBatchesForComponent(ctx.batches, component.id, ctx.now).length > 0;
    const goesWell = ctx.alreadyInMeal.some((otherId) => relationBetween(ctx.flavorPairs, component.id, otherId) === 'bien');
    const flavorOverlap = !goesWell && ctx.alreadyInMeal.some((otherId) => {
      const other = ctx.candidates.find((c) => c.id === otherId);
      return other?.flavorProfile?.some((tag) => component.flavorProfile?.includes(tag));
    });
    const recentlyUsed = ctx.recentlyUsedComponentIds.has(component.id);
    const highEffort = component.effort === 'alto';

    let score = 0;
    if (expiring) score += 500;
    score += macroFit;
    if (inStock) score += 50;
    if (goesWell) score += 30;
    else if (flavorOverlap) score += 10;
    score += ratingScore(ctx.ratings, component.id) * 5;
    if (recentlyUsed) score -= 40;
    if (highEffort) score -= 10;

    let reason: string;
    if (expiring) reason = 'usa algo que vence pronto';
    else if (macroFit > 60) reason = 'ayuda a llegar a la meta de macros';
    else if (inStock) reason = 'ya la tenés disponible';
    else if (goesWell) reason = 'combina bien con lo que ya pusiste';
    else if (flavorOverlap) reason = 'comparte sabor con lo que ya pusiste';
    else if (!recentlyUsed) reason = 'suma variedad al menú';
    else reason = 'opción disponible';

    scored.push({ component, score, reason });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(limit, 3));
}

/**
 * C5: ids de componentes usados en los últimos `windowDays` antes de `referenceDate` (sin contar
 * comidas libres ni, opcionalmente, la comida que se está armando) — ventana de variedad del doc,
 * 3 días por defecto, editable.
 */
export function recentlyUsedComponentIds(
  meals: AssembledMeal[],
  referenceDate: string,
  windowDays: number,
  excludeMealId?: string
): Set<string> {
  const ref = new Date(referenceDate + 'T00:00:00');
  const ids = new Set<string>();
  for (const meal of meals) {
    if (meal.id === excludeMealId || meal.isFreeMeal) continue;
    const mealDate = new Date(meal.date + 'T00:00:00');
    const diffDays = Math.round((ref.getTime() - mealDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0 && diffDays <= windowDays) {
      for (const entry of meal.entries) ids.add(entry.componentId);
    }
  }
  return ids;
}

/** "Otra opción": la siguiente sugerencia no mostrada todavía. */
export function nextAlternative(all: Suggestion[], shownIds: string[]): Suggestion | null {
  return all.find((s) => !shownIds.includes(s.component.id)) ?? null;
}
