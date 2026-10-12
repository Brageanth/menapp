import type { Component } from './component';

export type BatchStatus = 'planned' | 'available' | 'frozen' | 'depleted' | 'expired';

/** F2: una tanda preparada de un componente batchable. */
export interface ComponentBatch {
  id: string;
  componentId: string;
  preparedAt: string;
  totalPortions: number;
  remainingPortions: number;
  location: string;
  expiresAt: string | null;
  status: BatchStatus;
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** F2: registra un lote nuevo. El vencimiento se estima desde la vida útil cocinado del componente. */
export function createBatch(
  id: string,
  component: Component,
  preparedAt: string,
  totalPortions: number,
  location: string
): ComponentBatch {
  if (totalPortions <= 0) throw new Error('El lote necesita al menos una porción.');
  return {
    id,
    componentId: component.id,
    preparedAt,
    totalPortions,
    remainingPortions: totalPortions,
    location,
    expiresAt: component.cookedShelfLifeDays ? addDays(preparedAt, component.cookedShelfLifeDays) : null,
    status: 'available',
    updatedAt: nowIso(),
  };
}

/** F3: consume porciones de un lote al usarlo en una comida; pasa a agotado si llega a cero. */
export function consumePortions(batch: ComponentBatch, portions: number): ComponentBatch {
  const remaining = Math.max(0, batch.remainingPortions - portions);
  return { ...batch, remainingPortions: remaining, status: remaining === 0 ? 'depleted' : batch.status, updatedAt: nowIso() };
}

export function freezeBatch(batch: ComponentBatch): ComponentBatch {
  return { ...batch, status: 'frozen', updatedAt: nowIso() };
}

export function unfreezeBatch(batch: ComponentBatch): ComponentBatch {
  return { ...batch, status: batch.remainingPortions > 0 ? 'available' : 'depleted', updatedAt: nowIso() };
}

/** F3: vence sin usarse — se retira y queda registrado como desperdicio (nunca se borra). */
export function markExpired(batch: ComponentBatch): ComponentBatch {
  return { ...batch, status: 'expired', updatedAt: nowIso() };
}

export function isExpired(batch: ComponentBatch, now: Date): boolean {
  if (!batch.expiresAt) return false;
  return new Date(batch.expiresAt).getTime() < now.getTime();
}

/** Lotes con porciones disponibles para usar ahora (disponibles o congelados, no vencidos). */
export function usableBatchesForComponent(batches: ComponentBatch[], componentId: string, now: Date): ComponentBatch[] {
  return batches.filter(
    (b) => b.componentId === componentId && b.remainingPortions > 0 && (b.status === 'available' || b.status === 'frozen') && !isExpired(b, now)
  );
}

export interface PreparationPlan {
  byEffort: Record<'bajo' | 'medio' | 'alto' | 'sin-definir', Component[]>;
  /** F1: más de 3 componentes a preparar en una sola sesión sin agrupar por lote dispara alerta. */
  tooMuchEffort: boolean;
}

const EFFORT_ALERT_THRESHOLD = 3;

/** F1: agrupa los componentes pendientes de preparar por nivel de esfuerzo compartido. */
export function buildPreparationPlan(pendingComponents: Component[]): PreparationPlan {
  const byEffort: PreparationPlan['byEffort'] = { bajo: [], medio: [], alto: [], 'sin-definir': [] };
  for (const c of pendingComponents) {
    byEffort[c.effort ?? 'sin-definir'].push(c);
  }
  return { byEffort, tooMuchEffort: pendingComponents.length > EFFORT_ALERT_THRESHOLD };
}

/** Componentes batchable que no tienen ningún lote usable hoy — candidatos a preparar. */
export function componentsNeedingBatch(components: Component[], batches: ComponentBatch[], now: Date): Component[] {
  return components.filter((c) => c.batchable && c.status === 'active' && usableBatchesForComponent(batches, c.id, now).length === 0);
}
