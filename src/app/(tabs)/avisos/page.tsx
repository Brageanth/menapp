'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { notificationSettingsRepo } from '@/data/repositories/notification-settings-repo';
import { inventoryRepo } from '@/data/repositories/inventory-repo';
import { shoppingListRepo } from '@/data/repositories/shopping-list-repo';
import { menuRepo } from '@/data/repositories/menu-repo';
import { recipeRepo } from '@/data/repositories/recipe-repo';
import { buildDailyNotifications, defaultNotificationSettings, type NotificationSettings } from '@/domain/notification';
import { daysUntilExpiry, formatDateBadge, formatExpiryLabel, sortByExpiry, type InventoryItem } from '@/domain/inventory';
import { urgentShoppingItems, type ShoppingListItem } from '@/domain/shopping-list';
import { toDateKey, type MenuDay } from '@/domain/menu';
import type { Recipe } from '@/domain/recipe';
import { isPushSupported, getCurrentSubscription, subscribeToPush, unsubscribeFromPush } from '@/lib/push-client';

type SubState = 'checking' | 'off' | 'on' | 'unsupported' | 'denied';

interface FeedCard {
  key: string;
  label: string;
  title: string;
  body: string;
  href: string;
  linkLabel: string;
  badge: React.ReactNode;
}

function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

export default function AvisosPage() {
  const [settings, setSettings] = useState<NotificationSettings>(defaultNotificationSettings());
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [menuDays, setMenuDays] = useState<MenuDay[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [now, setNow] = useState<Date | null>(null);
  const [subState, setSubState] = useState<SubState>('checking');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const refresh = useCallback(async () => {
    const [current, inv, list, days, recs] = await Promise.all([
      notificationSettingsRepo.get(),
      inventoryRepo.list(),
      shoppingListRepo.list(),
      menuRepo.list(),
      recipeRepo.list(),
    ]);
    setSettings(current);
    setInventory(inv);
    setShoppingList(list);
    setMenuDays(days);
    setRecipes(recs);
    setNow(new Date());

    if (!isPushSupported()) {
      setSubState('unsupported');
    } else if (Notification.permission === 'denied') {
      setSubState('denied');
    } else {
      const sub = await getCurrentSubscription();
      setSubState(sub ? 'on' : 'off');
    }
  }, []);

  useEffect(() => {
    refresh().catch((err) => console.error('[avisos] load failed', err));
  }, [refresh]);

  const candidates = useMemo(
    () => (now ? buildDailyNotifications(settings, inventory, shoppingList, now) : []),
    [settings, inventory, shoppingList, now]
  );

  const urgent = useMemo(() => {
    if (!now) return [];
    const todayKey = toDateKey(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = toDateKey(tomorrow);
    return urgentShoppingItems(shoppingList, menuDays, recipes, todayKey, tomorrowKey);
  }, [shoppingList, menuDays, recipes, now]);

  const expiringItems = useMemo(() => {
    if (!now || !settings.notifyExpiring) return [];
    return inventory.filter((item) => {
      const days = daysUntilExpiry(item, now);
      return days !== null && days >= 0 && days <= settings.expiringMarginDays;
    });
  }, [inventory, now, settings.notifyExpiring, settings.expiringMarginDays]);

  const lowStockItems = useMemo(() => {
    if (!settings.notifyLowStock) return [];
    return inventory.filter((item) => item.quantity <= settings.lowStockThreshold);
  }, [inventory, settings.notifyLowStock, settings.lowStockThreshold]);

  const feedCards = useMemo<FeedCard[]>(() => {
    if (!now) return [];
    const cards: FeedCard[] = [];

    if (settings.notifyShopping) {
      if (urgent.length > 0) {
        const names = [...new Set(urgent.map((i) => i.name))];
        const recipeNames = [...new Set(urgent.map((i) => i.neededForRecipeName))];
        cards.push({
          key: 'shopping-urgent',
          label: 'Comprar pronto',
          title: joinList(names),
          body: `Te falta${names.length === 1 ? '' : 'n'} para ${joinList(recipeNames)} y lo necesitás en menos de 24 horas.`,
          href: '/compras',
          linkLabel: 'Ver la lista de compras',
          badge: <BagBadge />,
        });
      } else {
        const shoppingCandidate = candidates.find((c) => c.type === 'shopping');
        if (shoppingCandidate) {
          cards.push({
            key: 'shopping',
            label: 'Lista de compras',
            title: 'Pendiente por comprar',
            body: shoppingCandidate.body,
            href: '/compras',
            linkLabel: 'Ver la lista de compras',
            badge: <BagBadge />,
          });
        }
      }
    }

    if (expiringItems.length > 0) {
      const sorted = sortByExpiry(expiringItems, now);
      const nearest = sorted[0];
      const dateBadge = formatDateBadge(nearest, now);
      const label = formatExpiryLabel(nearest, now);
      cards.push({
        key: 'expiring',
        label: label === 'hoy' ? 'Vence hoy' : label === 'mañana' ? 'Vence mañana' : 'Por vencer',
        title: joinList(sorted.map((i) => i.name)),
        body: `Vence${sorted.length === 1 ? '' : 'n'} ${label}. Revisalo${sorted.length === 1 ? '' : 'n'} en la despensa.`,
        href: '/despensa',
        linkLabel: 'Ver la despensa',
        badge: <DateBadge top={dateBadge.top} bottom={dateBadge.bottom} />,
      });
    }

    if (lowStockItems.length > 0) {
      cards.push({
        key: 'low-stock',
        label: 'Se acaban',
        title: joinList(lowStockItems.map((i) => i.name)),
        body: `Está${lowStockItems.length === 1 ? '' : 'n'} por acabarse — agregalo${lowStockItems.length === 1 ? '' : 's'} a la lista de compras.`,
        href: '/compras',
        linkLabel: 'Ver la lista de compras',
        badge: <CountBadge label="quedan" count={lowStockItems.length} />,
      });
    }

    return cards;
  }, [now, settings.notifyShopping, urgent, candidates, expiringItems, lowStockItems]);

  function updateField<K extends keyof NotificationSettings>(field: K, value: NotificationSettings[K]) {
    setSaved(false);
    setSettings((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await notificationSettingsRepo.update(settings);
    setSaved(true);
    refresh().catch((err) => console.error('[avisos] refresh failed', err));
  }

  async function handleToggleDevice() {
    setBusy(true);
    try {
      if (subState === 'on') {
        await unsubscribeFromPush();
        setSubState('off');
      } else {
        const ok = await subscribeToPush();
        setSubState(ok ? 'on' : Notification.permission === 'denied' ? 'denied' : 'off');
      }
    } catch (err) {
      console.error('[avisos] toggle device failed', err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-[26px_24px]">
      <div>
        <Link href="/metas" className="text-[13px] text-muted">
          ← Metas
        </Link>
        <h1 className="font-serif text-[32px] mt-1.5">Avisos</h1>
        <p className="text-[13px] text-muted mt-2">
          {feedCards.length > 0
            ? `${feedCards.length} aviso${feedCards.length === 1 ? '' : 's'} hoy sobre tu despensa y lista de compras.`
            : 'Alertas sobre tu despensa y lista de compras, por notificación push. Avisa antes de que algo se dañe o falte.'}
        </p>
        <Link href="/avisos/costos" className="text-[13px] text-muted inline-block mt-2.5">
          Ver costos de IA →
        </Link>
      </div>

      <div className="p-3.5 rounded-[10px] border border-border flex flex-col gap-2.5">
        <p className="text-[13px] font-semibold">Este dispositivo</p>
        {subState === 'unsupported' && (
          <p className="text-[13px] text-muted">Este navegador no soporta notificaciones push.</p>
        )}
        {subState === 'denied' && (
          <p className="text-[13px] text-accent">
            Bloqueaste los permisos de notificación — habilitalos en los ajustes del navegador para este sitio.
          </p>
        )}
        {(subState === 'on' || subState === 'off' || subState === 'checking') && (
          <button
            type="button"
            disabled={busy || subState === 'checking'}
            onClick={handleToggleDevice}
            className={`p-3.5 rounded-[10px] font-semibold text-[14.5px] ${
              subState === 'on' ? 'bg-transparent text-foreground border border-foreground' : 'bg-foreground text-background border-none'
            }`}
            style={{ opacity: busy ? 0.6 : 1 }}
          >
            {subState === 'checking' ? 'Revisando…' : subState === 'on' ? 'Desactivar en este dispositivo' : 'Activar notificaciones'}
          </button>
        )}
      </div>

      {feedCards.length > 0 && (
        <div>
          <h3 className="font-serif text-[17px] pb-2">Hoy</h3>
          {feedCards.map((card) => (
            <FeedCardView key={card.key} card={card} />
          ))}
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <h3 className="font-serif text-[17px]">Cuándo avisarte</h3>

        <ToggleRow
          label="Por vencer"
          description="Si algo va a vencer pronto"
          checked={settings.notifyExpiring}
          onChange={(v) => updateField('notifyExpiring', v)}
        >
          <label className="flex items-center gap-2 text-[13px] text-muted">
            Avisar con
            <input
              type="number"
              min={0}
              step={1}
              value={settings.expiringMarginDays}
              onChange={(e) => updateField('expiringMarginDays', Number(e.target.value))}
              className="w-[60px] p-[8px_10px] rounded-lg border border-foreground text-base bg-transparent text-foreground"
            />
            días de margen
          </label>
        </ToggleRow>

        <ToggleRow
          label="Bajo stock"
          description="Si algo se está acabando"
          checked={settings.notifyLowStock}
          onChange={(v) => updateField('notifyLowStock', v)}
        >
          <label className="flex items-center gap-2 text-[13px] text-muted">
            Avisar cuando quede
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={settings.lowStockThreshold}
              onChange={(e) => updateField('lowStockThreshold', Number(e.target.value))}
              className="w-[60px] p-[8px_10px] rounded-lg border border-foreground text-base bg-transparent text-foreground"
            />
            o menos
          </label>
        </ToggleRow>

        <ToggleRow
          label="Comprar hoy"
          description="Si hay ítems sin marcar como comprados en la lista"
          checked={settings.notifyShopping}
          onChange={(v) => updateField('notifyShopping', v)}
        />

        <label className="flex flex-col gap-1.5 text-[13px] text-muted">
          Hora diaria aproximada
          <input
            type="time"
            value={settings.dailyHour}
            onChange={(e) => updateField('dailyHour', e.target.value)}
            className="p-[12px_14px] rounded-lg border border-foreground text-base bg-transparent text-foreground"
          />
          <span className="text-[11.5px]">
            Referencia — en el plan free de Vercel el envío corre una vez al día a una hora fija del servidor, puede no coincidir exacto con esto.
          </span>
        </label>

        <button type="submit" className="p-3.5 rounded-[10px] bg-foreground text-background font-semibold text-[14.5px] border-none">
          Guardar
        </button>
        {saved && <p className="text-[13px] text-muted">Guardado.</p>}
      </form>
    </div>
  );
}

function FeedCardView({ card }: { card: FeedCard }) {
  return (
    <div className="flex gap-[13px] p-[13px_12px] bg-accent-soft rounded-md mb-2">
      <span className="w-[50px] h-[54px] rounded-[5px] flex-shrink-0 flex flex-col items-center justify-center gap-[3px] bg-accent text-white">
        {card.badge}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
        <span className="text-xs font-semibold text-accent">{card.label}</span>
        <div className="text-[15px] font-semibold leading-[1.3]">{card.title}</div>
        <div className="text-[12.5px] text-accent-soft-foreground leading-[1.4]">{card.body}</div>
        <Link
          href={card.href}
          className="mt-0.5 self-start min-h-11 inline-flex items-center text-[13px] font-bold underline underline-offset-4 text-accent"
        >
          {card.linkLabel}
        </Link>
      </div>
    </div>
  );
}

function BagBadge() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function DateBadge({ top, bottom }: { top: string; bottom: string }) {
  return (
    <>
      <span className="text-[10.5px] font-semibold leading-none opacity-90">{top}</span>
      <span className="font-serif text-[22px] leading-[1.05]">{bottom}</span>
    </>
  );
}

function CountBadge({ label, count }: { label: string; count: number }) {
  return (
    <>
      <span className="text-[10.5px] font-semibold leading-none opacity-90">{label}</span>
      <span className="font-serif text-[22px] leading-[1.05]">{count}</span>
    </>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`w-10 h-[23px] rounded-full relative flex-shrink-0 ${checked ? 'bg-foreground' : 'bg-border'}`}
    >
      <span
        className="absolute top-[2.5px] w-[18px] h-[18px] rounded-full bg-background"
        style={{ left: checked ? 19 : 2.5 }}
      />
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  children,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 pb-3 border-b border-border">
      <div className="flex items-center gap-3.5">
        <div className="flex-1">
          <div className="text-[14.5px] font-medium">{label}</div>
          <div className="text-[12.5px] text-muted mt-0.5 leading-[1.3]">{description}</div>
        </div>
        <Switch checked={checked} onChange={onChange} label={label} />
      </div>
      {checked && children}
    </div>
  );
}
