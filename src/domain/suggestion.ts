import type { Component, RoleId } from './component';
import { macrosForQuantity, purchaseNames } from './component';
import type { InventoryItem } from './inventory';
import { findStock, isExpiringSoon, stockAvailable } from './inventory';
import { canonicalAmount } from './quantity';
import type { ComponentBatch } from './component-batch';
import { usableBatchesForComponent } from './component-batch';
import type { FlavorPair } from './flavor-pair';
import { relationBetween } from './flavor-pair';
import type { ComponentRating } from './component-rating';
import { ratingScore } from './component-rating';
import type { AssembledMeal } from './meal-assembly';
import type { MealSlot } from './meal-slot';

export interface SuggestionContext {
  role: RoleId;
  /** Comida que se está armando — si se da, descarta candidatos con `typicalSlots` que no la incluyan. */
  slot?: MealSlot;
  candidates: Component[];
  inventory: InventoryItem[];
  batches: ComponentBatch[];
  flavorPairs: FlavorPair[];
  ratings: ComponentRating[];
  /** ids ya usados dentro de la ventana de variedad (por defecto 3 días, ver `recentlyUsedComponentIds`). */
  recentlyUsedComponentIds: Set<string>;
  /** veces que se usó cada componente en el horizonte de variedad (ver `recentUseCounts`) — desempata a favor de lo menos usado. */
  recentUseCounts?: Map<string, number>;
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
  const names = purchaseNames(component);
  const typical = canonicalAmount(component.portion.typical, component.unit).quantity / names.length;
  return names.every((name) => {
    const have = stockAvailable(inventory, name, component.unit);
    return have !== null && have > 0 && have >= typical;
  });
}

/**
 * ¿Se puede preparar/servir ya con lo que hay? Un lote usable lo resuelve; si no, un componente simple
 * necesita su producto en la despensa y uno preparado todos sus ingredientes (en la cantidad que pide
 * cuando es comparable, o al menos algo cuando la unidad no lo es).
 */
export function isComponentAvailable(
  component: Component,
  inventory: InventoryItem[],
  batches: ComponentBatch[],
  now: Date
): boolean {
  if (usableBatchesForComponent(batches, component.id, now).length > 0) return true;
  if (component.origin === 'preparado' && component.ingredients && component.ingredients.length > 0) {
    return component.ingredients.every((ing) => {
      const have = stockAvailable(inventory, ing.name, ing.unit);
      return have !== null ? have >= canonicalAmount(ing.quantity, ing.unit).quantity : findStock(inventory, ing.name).length > 0;
    });
  }
  return hasStock(component, inventory);
}

function hasExpiringStock(component: Component, inventory: InventoryItem[], now: Date): boolean {
  return purchaseNames(component).some((name) => findStock(inventory, name).some((stock) => isExpiringSoon(stock, now)));
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

  // Un plato completo (ej. pasta carbonara) ya cubre varios roles por sí solo — no sumar otro
  // plato completo a la misma comida aunque pida un rol distinto (ej. perro caliente de "proteina").
  const mealHasCompleteDish = ctx.alreadyInMeal.some(
    (id) => ctx.candidates.find((c) => c.id === id)?.isCompleteDish
  );

  for (const component of ctx.candidates) {
    if (!component.roles.includes(ctx.role) || component.status !== 'active') continue;
    if (ctx.slot && component.typicalSlots && !component.typicalSlots.includes(ctx.slot)) continue;
    if (mealHasCompleteDish && component.isCompleteDish) continue;

    const avoided = ctx.alreadyInMeal.some((otherId) => relationBetween(ctx.flavorPairs, component.id, otherId) === 'evitar');
    if (avoided) continue;

    // Rating neto negativo ("no me gusta") descarta el candidato, no solo lo penaliza.
    if (ratingScore(ctx.ratings, component.id) < 0) continue;

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
    if (recentlyUsed) score -= 1000;
    score -= (ctx.recentUseCounts?.get(component.id) ?? 0) * REUSE_PENALTY;
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

  // Si filtrar por comida dejó la lista vacía, mejor mostrar algo que nada.
  if (scored.length === 0 && ctx.slot) return suggestComponentsForRole({ ...ctx, slot: undefined }, limit);

  // Si descartar por rating negativo dejó la lista vacía, no hay opción: mostrar algo es mejor que nada.
  if (scored.length === 0 && ctx.ratings.some((r) => r.score < 0)) {
    return suggestComponentsForRole({ ...ctx, ratings: [] }, limit);
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(limit, 3));
}

/** Castigo por cada uso reciente: mayor que lo que suman stock/macros/rating, menor que vencer pronto (+500). */
const REUSE_PENALTY = 150;

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

/**
 * Cuántas veces se usó cada componente en los `horizonDays` días anteriores a `referenceDate`. La ventana de
 * variedad solo bloquea los últimos días; esto evita que lo mejor puntuado vuelva apenas sale de la ventana
 * (ciclo de ventana+1 días) mientras haya candidatos sin usar.
 */
export function recentUseCounts(meals: AssembledMeal[], referenceDate: string, horizonDays: number): Map<string, number> {
  const ref = new Date(referenceDate + 'T00:00:00');
  const counts = new Map<string, number>();
  for (const meal of meals) {
    if (meal.isFreeMeal) continue;
    const diffDays = Math.round((ref.getTime() - new Date(meal.date + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0 || diffDays > horizonDays) continue;
    for (const entry of meal.entries) counts.set(entry.componentId, (counts.get(entry.componentId) ?? 0) + 1);
  }
  return counts;
}

/** "Otra opción": la siguiente sugerencia no mostrada todavía. */
export function nextAlternative(all: Suggestion[], shownIds: string[]): Suggestion | null {
  return all.find((s) => !shownIds.includes(s.component.id)) ?? null;
}
