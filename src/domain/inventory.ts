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

export function daysUntilExpiry(item: InventoryItem, now = new Date()): number | null {
  if (!item.expiresAt) return null;
  const expiry = new Date(item.expiresAt);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((expiry.getTime() - now.getTime()) / msPerDay);
}

export function isExpiringSoon(item: InventoryItem, thresholdDays = 3, now = new Date()): boolean {
  const days = daysUntilExpiry(item, now);
  return days !== null && days <= thresholdDays;
}
