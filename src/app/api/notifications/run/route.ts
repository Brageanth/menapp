import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { buildDailyNotifications, defaultNotificationSettings, type NotificationSettings } from '@/domain/notification';
import type { InventoryItem } from '@/domain/inventory';
import type { ShoppingListItem } from '@/domain/shopping-list';

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function settingsFromRow(row: Record<string, unknown> | null): NotificationSettings {
  if (!row) return defaultNotificationSettings();
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

function inventoryFromRow(row: Record<string, unknown>): InventoryItem {
  return {
    id: row.id as string,
    name: row.name as string,
    quantity: (row.quantity as number) ?? 0,
    unit: (row.unit as string) ?? '',
    location: (row.location as InventoryItem['location']) ?? 'alacena',
    expiresAt: (row.expires_at as string | null) ?? null,
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

function shoppingFromRow(row: Record<string, unknown>): ShoppingListItem {
  return {
    id: row.id as string,
    name: row.name as string,
    quantity: (row.quantity as number) ?? 0,
    unit: (row.unit as string) ?? '',
    category: (row.category as ShoppingListItem['category']) ?? 'otros',
    purchased: Boolean(row.purchased),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

/** Dispara vía Vercel Cron (hourly) — este endpoint decide si ya es la hora configurada y si hoy no se mandó todavía. */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const supabase = serviceClient();
  const now = new Date();

  const { data: settingsRow } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();
  const settings = settingsFromRow(settingsRow);

  const todayKey = now.toISOString().slice(0, 10);
  const dedupeType = `daily-digest:${todayKey}`;
  const { data: already } = await supabase.from('notifications').select('id').eq('type', dedupeType).limit(1);
  if (already && already.length > 0) {
    return Response.json({ skipped: true, reason: 'already-sent' });
  }

  const [{ data: inventoryRows }, { data: shoppingRows }, { data: subscriptions }] = await Promise.all([
    supabase.from('inventory_items').select('*'),
    supabase.from('shopping_list_items').select('*'),
    supabase.from('push_subscriptions').select('*'),
  ]);

  const candidates = buildDailyNotifications(
    settings,
    (inventoryRows ?? []).map(inventoryFromRow),
    (shoppingRows ?? []).map(shoppingFromRow),
    now
  );

  await supabase.from('notifications').insert({ type: dedupeType, payload: { candidates }, sent_at: now.toISOString() });

  if (candidates.length === 0 || !subscriptions || subscriptions.length === 0) {
    return Response.json({ sent: 0, candidates: candidates.length });
  }

  webpush.setVapidDetails(
    'mailto:brageanth@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  let sent = 0;
  for (const sub of subscriptions) {
    for (const candidate of candidates) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint as string, keys: { p256dh: sub.p256dh as string, auth: sub.auth as string } },
          JSON.stringify({ title: candidate.title, body: candidate.body })
        );
        sent += 1;
      } catch (err) {
        console.error('[push] send failed', sub.endpoint, err);
        if ((err as { statusCode?: number }).statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint as string);
        }
      }
    }
  }

  return Response.json({ sent, candidates: candidates.length });
}
