import { canonicalAmount, convertToUnit, normalizeItemName, roundAmount } from './quantity';

export type InventoryLocation = 'nevera' | 'alacena';

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  /** Gramos por unidad (ej. 3 aguacates de ~200 g) — permite comparar "3 unidades" contra "400 g". */
  unitWeight?: number | null;
  location: InventoryLocation;
  expiresAt: string | null;
  updatedAt: string;
}

/** Mismo item con cantidad y unidad en su forma canónica ("0.2 Kg" → 200 g). */
export function canonicalizeItem(item: InventoryItem): InventoryItem {
  const { quantity, unit } = canonicalAmount(item.quantity, item.unit);
  return { ...item, quantity, unit };
}

function sameProduct(a: Pick<InventoryItem, 'name'>, b: Pick<InventoryItem, 'name'>): boolean {
  return normalizeItemName(a.name) === normalizeItemName(b.name);
}

/** Cantidad de `other` expresada en la unidad de `base`, o null si no hay forma de compararlas. */
function amountInUnitOf(base: InventoryItem, other: InventoryItem): number | null {
  return convertToUnit({ quantity: other.quantity, unit: other.unit }, base.unit, base.unitWeight ?? other.unitWeight);
}

/**
 * Suma `incoming` sobre `existing` (queda la unidad, ubicación e id del existente; vence lo más
 * pronto). null si son productos que no se pueden sumar (ej. "3 unidades" y "400 g" sin peso por unidad).
 */
export function mergeStock(existing: InventoryItem, incoming: InventoryItem): InventoryItem | null {
  const base = canonicalizeItem(existing);
  const extra = canonicalizeItem(incoming);
  const added = amountInUnitOf(base, extra);
  if (added === null) return null;
  const expiries = [base.expiresAt, extra.expiresAt].filter((d): d is string => !!d).sort();
  const unitWeight = base.unitWeight ?? extra.unitWeight;
  return {
    ...base,
    quantity: roundAmount(base.quantity + added),
    ...(unitWeight != null && { unitWeight }),
    expiresAt: expiries[0] ?? null,
    updatedAt: new Date().toISOString(),
  };
}

/** Qué hay que escribir al agregar `incoming`: sumarlo al mismo producto si ya está, o crearlo. */
export function addToInventory(items: InventoryItem[], incoming: InventoryItem): { item: InventoryItem; merged: boolean } {
  const clean = canonicalizeItem(incoming);
  for (const existing of items) {
    if (!sameProduct(existing, clean)) continue;
    const merged = mergeStock(existing, clean);
    if (merged) return { item: merged, merged: true };
  }
  return { item: clean, merged: false };
}

/** Grupos de 2+ filas que son el mismo producto y se pueden sumar (duplicados ya guardados). */
export function findDuplicateGroups(items: InventoryItem[]): InventoryItem[][] {
  const byName = new Map<string, InventoryItem[][]>();
  for (const item of items) {
    const key = normalizeItemName(item.name);
    const clusters = byName.get(key) ?? [];
    const home = clusters.find((c) => mergeStock(c[0], item) !== null);
    if (home) home.push(item);
    else clusters.push([item]);
    byName.set(key, clusters);
  }
  return [...byName.values()].flat().filter((c) => c.length > 1);
}

/** Una sola fila con la suma del grupo — la primera del grupo es la que sobrevive (id, nombre, ubicación). */
export function consolidateGroup(group: InventoryItem[]): InventoryItem {
  return group.slice(1).reduce((acc, item) => mergeStock(acc, item) ?? acc, canonicalizeItem(group[0]));
}

/** Filas de la despensa que corresponden a `name` (sin importar plural, acentos ni mayúsculas). */
export function findStock(items: InventoryItem[], name: string): InventoryItem[] {
  const key = normalizeItemName(name);
  return items.filter((i) => normalizeItemName(i.name) === key);
}

/**
 * Cuánto hay de `name` expresado en la unidad canónica de `unit` (sumando todas sus filas). 0 si no
 * hay nada; null si hay pero en una unidad que no se puede comparar (ej. 3 unidades y se pide en g).
 */
export function stockAvailable(items: InventoryItem[], name: string, unit: string): number | null {
  const rows = findStock(items, name);
  if (rows.length === 0) return 0;
  let total = 0;
  let comparable = false;
  for (const row of rows) {
    const q = convertToUnit({ quantity: row.quantity, unit: row.unit }, unit, row.unitWeight);
    if (q === null) continue;
    total += q;
    comparable = true;
  }
  return comparable ? roundAmount(total) : null;
}

/** Bajo stock solo tiene sentido para conteos — un umbral de "1" no dice nada sobre 200 g. */
export function isLowStock(item: InventoryItem, threshold: number): boolean {
  const { quantity, unit } = canonicalAmount(item.quantity, item.unit);
  return unit === 'unidad' && quantity <= threshold;
}

/** Parses a date-only string ("YYYY-MM-DD") as local midnight, not UTC — avoids an off-by-one-day shift in timezones behind UTC. */
function parseLocalDate(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function daysUntilExpiry(item: InventoryItem, now: Date): number | null {
  if (!item.expiresAt) return null;
  const expiry = parseLocalDate(item.expiresAt);
  const msPerDay = 1000 * 60 * 60 * 24;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryDay = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  return Math.round((expiryDay.getTime() - today.getTime()) / msPerDay);
}

export function isExpiringSoon(item: InventoryItem, now: Date, thresholdDays = 3): boolean {
  const days = daysUntilExpiry(item, now);
  return days !== null && days <= thresholdDays;
}

export type ExpiryUrgency = 'vencido' | 'urgente' | 'proximo' | 'normal' | 'sin-fecha';

export function expiryUrgency(item: InventoryItem, now: Date): ExpiryUrgency {
  const days = daysUntilExpiry(item, now);
  if (days === null) return 'sin-fecha';
  if (days < 0) return 'vencido';
  if (days <= 1) return 'urgente';
  if (days <= 3) return 'proximo';
  return 'normal';
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatDateBadge(item: InventoryItem, now: Date): { top: string; bottom: string } {
  if (!item.expiresAt) return { top: '', bottom: '—' };
  const expiry = parseLocalDate(item.expiresAt);
  const days = daysUntilExpiry(item, now) ?? 0;
  if (days > 300) {
    return { top: String(expiry.getFullYear()), bottom: MONTHS_ES[expiry.getMonth()] };
  }
  return { top: MONTHS_ES[expiry.getMonth()], bottom: String(expiry.getDate()) };
}

export function formatExpiryLabel(item: InventoryItem, now: Date): string {
  const days = daysUntilExpiry(item, now);
  if (days === null) return '';
  if (days < 0) return 'vencido';
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  if (days <= 30) return `en ${days} días`;
  const months = Math.round(days / 30);
  return `en ${months} ${months === 1 ? 'mes' : 'meses'}`;
}

export function sortByExpiry(items: InventoryItem[], now: Date): InventoryItem[] {
  return [...items].sort((a, b) => {
    const da = daysUntilExpiry(a, now);
    const db = daysUntilExpiry(b, now);
    if (da === null && db === null) return a.name.localeCompare(b.name);
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });
}

export function filterByQuery(items: InventoryItem[], query: string): InventoryItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => item.name.toLowerCase().includes(q));
}
