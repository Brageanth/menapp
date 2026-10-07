import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { mergePulledRows } from '../sync-pull';
import { supabase } from '../supabase-client';
import { defaultNotificationSettings, type NotificationSettings } from '@/domain/notification';

/** Supabase columns are snake_case; local/domain objects are camelCase. Fila única ('default'), un solo hogar. */
function toRow(settings: NotificationSettings) {
  return {
    id: settings.id,
    notify_expiring: settings.notifyExpiring,
    expiring_margin_days: settings.expiringMarginDays,
    notify_low_stock: settings.notifyLowStock,
    low_stock_threshold: settings.lowStockThreshold,
    notify_shopping: settings.notifyShopping,
    daily_hour: settings.dailyHour,
  };
}

function fromRow(row: Record<string, unknown>): NotificationSettings {
  return {
    id: 'default',
    notifyExpiring: row.notify_expiring as boolean,
    expiringMarginDays: row.expiring_margin_days as number,
    notifyLowStock: row.notify_low_stock as boolean,
    lowStockThreshold: row.low_stock_threshold as number,
    notifyShopping: row.notify_shopping as boolean,
    dailyHour: row.daily_hour as string,
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

export const notificationSettingsRepo = {
  async get(): Promise<NotificationSettings> {
    const existing = await db.notificationSettings.get('default');
    return existing ?? defaultNotificationSettings();
  },

  async update(settings: NotificationSettings): Promise<void> {
    await db.notificationSettings.put(settings);
    await enqueueWrite('notification_settings', 'update', toRow(settings));
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('notification_settings').select('*').eq('id', 'default').maybeSingle();
    if (data) await mergePulledRows(db.notificationSettings, [fromRow(data)], (r) => r.updatedAt);
  },
};
