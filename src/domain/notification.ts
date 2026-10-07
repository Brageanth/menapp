import type { InventoryItem } from './inventory';
import type { ShoppingListItem } from './shopping-list';
import { daysUntilExpiry } from './inventory';

export interface NotificationSettings {
  id: 'default';
  notifyExpiring: boolean;
  expiringMarginDays: number;
  notifyLowStock: boolean;
  lowStockThreshold: number;
  notifyShopping: boolean;
  dailyHour: string;
  updatedAt: string;
}

export function defaultNotificationSettings(): NotificationSettings {
  return {
    id: 'default',
    notifyExpiring: true,
    expiringMarginDays: 2,
    notifyLowStock: true,
    lowStockThreshold: 1,
    notifyShopping: true,
    dailyHour: '09:00',
    updatedAt: new Date().toISOString(),
  };
}

export interface NotificationCandidate {
  type: 'expiring' | 'low-stock' | 'shopping';
  title: string;
  body: string;
}

/** Misma regla para la vista previa en Avisos_B y para el cron que manda los Web Push — nunca duplicar la lógica. */
export function buildDailyNotifications(
  settings: NotificationSettings,
  inventory: InventoryItem[],
  shoppingList: ShoppingListItem[],
  now: Date
): NotificationCandidate[] {
  const out: NotificationCandidate[] = [];

  if (settings.notifyExpiring) {
    const expiring = inventory.filter((item) => {
      const days = daysUntilExpiry(item, now);
      return days !== null && days >= 0 && days <= settings.expiringMarginDays;
    });
    if (expiring.length > 0) {
      out.push({
        type: 'expiring',
        title: 'Por vencer pronto',
        body: `${expiring.map((i) => i.name).join(', ')} vence${expiring.length === 1 ? '' : 'n'} en ${settings.expiringMarginDays} día${settings.expiringMarginDays === 1 ? '' : 's'} o menos.`,
      });
    }
  }

  if (settings.notifyLowStock) {
    const low = inventory.filter((item) => item.quantity <= settings.lowStockThreshold);
    if (low.length > 0) {
      out.push({
        type: 'low-stock',
        title: 'Bajo stock',
        body: `${low.map((i) => i.name).join(', ')} está${low.length === 1 ? '' : 'n'} por acabarse.`,
      });
    }
  }

  if (settings.notifyShopping) {
    const pending = shoppingList.filter((i) => !i.purchased);
    if (pending.length > 0) {
      out.push({
        type: 'shopping',
        title: 'Lista de compras',
        body: `Tenés ${pending.length} ítem${pending.length === 1 ? '' : 's'} pendiente${pending.length === 1 ? '' : 's'} de comprar hoy.`,
      });
    }
  }

  return out;
}
