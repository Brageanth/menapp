'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { inventoryRepo } from '@/data/repositories/inventory-repo';
import { shoppingListRepo } from '@/data/repositories/shopping-list-repo';
import { assembledMealRepo } from '@/data/repositories/assembled-meal-repo';
import { componentRepo } from '@/data/repositories/component-repo';
import { componentBatchRepo } from '@/data/repositories/component-batch-repo';
import { todayDate, toDateKey } from '@/domain/date';
import { SLOT_LABELS, ALL_SLOTS } from '@/domain/meal-slot';
import type { InventoryItem } from '@/domain/inventory';
import { daysUntilExpiry, formatExpiryLabel } from '@/domain/inventory';
import type { ShoppingListItem } from '@/domain/shopping-list';
import { urgentShoppingItemsFromComponents } from '@/domain/shopping-list';
import type { Component } from '@/domain/component';
import type { ComponentBatch } from '@/domain/component-batch';
import type { AssembledMeal } from '@/domain/meal-assembly';

export default function HoyPage() {
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingListItem[]>([]);
  const [meals, setMeals] = useState<AssembledMeal[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [batches, setBatches] = useState<ComponentBatch[]>([]);
  const [today, setToday] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [i, s, am, c, b] = await Promise.all([
      inventoryRepo.list(),
      shoppingListRepo.list(),
      assembledMealRepo.list(),
      componentRepo.list(),
      componentBatchRepo.list(),
    ]);
    setInventory(i);
    setShoppingItems(s);
    setMeals(am);
    setComponents(c);
    setBatches(b);
  }, []);

  useEffect(() => {
    setToday(todayDate());
    refresh().catch((err) => console.error('[hoy] list failed', err));
  }, [refresh]);

  const componentMap = useMemo(() => new Map(components.map((c) => [c.id, c])), [components]);
  const todayMeals = useMemo(() => (today ? meals.filter((m) => m.date === today) : []), [meals, today]);

  const tomorrow = useMemo(() => {
    if (!today) return null;
    const [y, m, d] = today.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + 1);
    return toDateKey(date);
  }, [today]);

  const shoppingAlert = useMemo(() => {
    if (!today || !tomorrow) return null;
    const urgent = urgentShoppingItemsFromComponents(shoppingItems, meals, components, batches, today, tomorrow, new Date());
    if (urgent.length === 0) return null;
    const names = urgent.slice(0, 2).map((i) => i.name);
    const rest = urgent.length - names.length;
    const itemsText = names.join(' y ') + (rest > 0 ? ` y ${rest} más` : '');
    const neededFor = Array.from(new Set(urgent.map((i) => i.neededFor)));
    return {
      title: `Te falta${urgent.length === 1 ? '' : 'n'} ${itemsText}`,
      subtitle: `Para ${neededFor.slice(0, 2).join(' y ')}.`,
    };
  }, [shoppingItems, meals, components, batches, today, tomorrow]);

  const expiringAlert = useMemo(() => {
    const now = new Date();
    const soon = inventory
      .map((item) => ({ item, days: daysUntilExpiry(item, now) }))
      .filter((x) => x.days !== null && x.days <= 2)
      .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
    if (soon.length === 0) return null;
    const first = soon[0];
    const names = soon.slice(0, 3).map((x) => x.item.name);
    return {
      label: formatExpiryLabel(first.item, now),
      title: names.join(', '),
    };
  }, [inventory]);

  const hasAlerts = !!shoppingAlert || !!expiringAlert;

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '26px 24px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <h1 className="font-serif" style={{ fontSize: 38, lineHeight: 1 }}>
            Hoy
          </h1>
        </div>
        <Link
          href="/avisos"
          aria-label="Avisos"
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            border: '1px solid var(--foreground)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </Link>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 24px 24px', display: 'flex', flexDirection: 'column' }}>
        {hasAlerts && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {shoppingAlert && (
              <Link
                href="/compras"
                className="bg-accent-soft"
                style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px 12px 12px', borderRadius: 6 }}
              >
                <span
                  className="bg-accent"
                  style={{
                    width: 50,
                    height: 54,
                    borderRadius: 5,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                  }}
                >
                  <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-accent" style={{ fontSize: 12, fontWeight: 600 }}>
                    Comprar hoy
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, marginTop: 1 }}>{shoppingAlert.title}</div>
                  <div className="text-accent-soft-foreground" style={{ fontSize: 12.5, lineHeight: 1.35, marginTop: 2 }}>
                    {shoppingAlert.subtitle}
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-accent" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            )}

            {expiringAlert && (
              <Link
                href="/despensa"
                className="bg-accent-soft"
                style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px 12px 12px', borderRadius: 6 }}
              >
                <span
                  className="bg-accent"
                  style={{
                    width: 50,
                    height: 54,
                    borderRadius: 5,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {expiringAlert.label}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-accent" style={{ fontSize: 12, fontWeight: 600 }}>
                    Vence pronto
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, marginTop: 1 }}>{expiringAlert.title}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-accent" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {ALL_SLOTS.map((slot, i) => {
            const meal = todayMeals.find((m) => m.slot === slot);
            const summary = meal
              ? meal.isFreeMeal
                ? meal.freeMealDescription ?? 'Comida libre'
                : meal.entries.map((e) => componentMap.get(e.componentId)?.name).filter(Boolean).join(' + ')
              : null;
            return (
              <button
                key={slot}
                onClick={() => router.push('/armar')}
                style={{
                  textAlign: 'left',
                  display: 'block',
                  padding: '17px 0',
                  borderBottom: i < ALL_SLOTS.length - 1 ? '1px solid var(--border)' : 'none',
                  background: 'transparent',
                }}
              >
                <div className="text-muted" style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                  {SLOT_LABELS[slot]}
                </div>
                <div className="font-serif" style={{ fontSize: 20, lineHeight: 1.22, color: summary ? 'var(--foreground)' : 'var(--muted)' }}>
                  {summary || 'Sin asignar'}
                </div>
              </button>
            );
          })}
        </div>

        <Link
          href="/armar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            padding: 14,
            borderRadius: 10,
            fontSize: 14.5,
            fontWeight: 600,
            marginTop: 18,
            background: 'var(--foreground)',
            color: 'var(--background)',
            border: '1px solid var(--foreground)',
          }}
        >
          Armar el día
        </Link>
      </div>
    </div>
  );
}
