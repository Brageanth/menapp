export type InventoryLocation = 'nevera' | 'alacena';

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  location: InventoryLocation;
  expiresAt: string | null;
  updatedAt: string;
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
