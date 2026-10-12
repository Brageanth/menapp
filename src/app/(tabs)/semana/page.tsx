'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { inventoryRepo } from '@/data/repositories/inventory-repo';
import { assembledMealRepo } from '@/data/repositories/assembled-meal-repo';
import { componentRepo } from '@/data/repositories/component-repo';
import { componentBatchRepo } from '@/data/repositories/component-batch-repo';
import { startOfWeek, weekDates, todayDate } from '@/domain/date';
import { ALL_SLOTS, type MealSlot } from '@/domain/meal-slot';
import type { InventoryItem } from '@/domain/inventory';
import { deriveShoppingListFromComponents } from '@/domain/shopping-list';
import type { Component } from '@/domain/component';
import type { ComponentBatch } from '@/domain/component-batch';
import type { AssembledMeal } from '@/domain/meal-assembly';

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function SemanaPage() {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [meals, setMeals] = useState<AssembledMeal[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [batches, setBatches] = useState<ComponentBatch[]>([]);
  const [today, setToday] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [i, am, c, b] = await Promise.all([
      inventoryRepo.list(),
      assembledMealRepo.list(),
      componentRepo.list(),
      componentBatchRepo.list(),
    ]);
    setInventory(i);
    setMeals(am);
    setComponents(c);
    setBatches(b);
  }, []);

  useEffect(() => {
    setWeekStart(startOfWeek(new Date()));
    setToday(todayDate());
    refresh().catch((err) => console.error('[semana] list failed', err));
  }, [refresh]);

  const dates = useMemo(() => (weekStart ? weekDates(weekStart) : []), [weekStart]);
  const componentMap = useMemo(() => new Map(components.map((c) => [c.id, c])), [components]);
  const weekMeals = useMemo(() => meals.filter((m) => dates.includes(m.date)), [meals, dates]);

  const pendingShoppingCount = useMemo(
    () => deriveShoppingListFromComponents(weekMeals, components, inventory, batches, new Date()).length,
    [weekMeals, components, inventory, batches]
  );

  const variety = useMemo(() => {
    const seen = new Set<string>();
    const repeated = new Set<string>();
    const proteins = new Set<string>();
    for (const meal of weekMeals) {
      for (const entry of meal.entries) {
        if (seen.has(entry.componentId)) repeated.add(entry.componentId);
        seen.add(entry.componentId);
        const component = componentMap.get(entry.componentId);
        if (component?.roles.includes('proteina')) proteins.add(component.id);
      }
    }
    return { repeatedCount: repeated.size, distinctProteins: proteins.size };
  }, [weekMeals, componentMap]);

  function findMeal(date: string, slot: MealSlot): AssembledMeal | undefined {
    return meals.find((m) => m.date === date && m.slot === slot);
  }

  function summaryFor(meal: AssembledMeal | undefined): string | null {
    if (!meal) return null;
    if (meal.isFreeMeal) return meal.freeMealDescription ?? 'Comida libre';
    if (meal.entries.length === 0) return null;
    return meal.entries.map((e) => componentMap.get(e.componentId)?.name).filter(Boolean).join(' + ');
  }

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '22px 24px 14px', borderBottom: '1px solid #E3DED3', display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h1 style={{ fontSize: 32 }}>Semana</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link
              href="/armar"
              style={{ fontSize: 12.5, padding: '5px 12px', borderRadius: 999, border: '1px solid #2B2724', background: 'transparent', color: '#2B2724', fontWeight: 600 }}
            >
              Armar
            </Link>
            <Link
              href="/compras"
              style={{
                fontSize: 12.5,
                padding: '5px 12px',
                borderRadius: 999,
                border: `1px solid ${pendingShoppingCount > 0 ? '#A8412B' : '#E3DED3'}`,
                background: pendingShoppingCount > 0 ? '#F6E4DC' : 'transparent',
                color: pendingShoppingCount > 0 ? '#A8412B' : '#766F64',
                fontWeight: 600,
              }}
            >
              Compras{pendingShoppingCount > 0 ? ` (${pendingShoppingCount})` : ''}
            </Link>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              aria-label="Semana anterior"
              onClick={() => setWeekStart((d) => { const n = new Date(d ?? startOfWeek(new Date())); n.setDate(n.getDate() - 7); return n; })}
              style={navButtonStyle}
            >
              ‹
            </button>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#2B2724', minWidth: 92, textAlign: 'center' }}>
              {dates.length > 0 ? `${dates[0].slice(5)} — ${dates[6].slice(5)}` : ''}
            </span>
            <button
              aria-label="Semana siguiente"
              onClick={() => setWeekStart((d) => { const n = new Date(d ?? startOfWeek(new Date())); n.setDate(n.getDate() + 7); return n; })}
              style={navButtonStyle}
            >
              ›
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, fontSize: 12.5, color: '#766F64' }}>
          <span>
            {variety.repeatedCount > 0
              ? `${variety.repeatedCount} componente${variety.repeatedCount === 1 ? '' : 's'} repetido${variety.repeatedCount === 1 ? '' : 's'}`
              : 'Sin componentes repetidos'}
          </span>
          <span>
            {variety.distinctProteins} proteína{variety.distinctProteins === 1 ? '' : 's'} distinta{variety.distinctProteins === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 24px 20px' }}>
        <div style={{ fontSize: 11.5, color: '#766F64', padding: '10px 0 2px' }}>
          D desayuno, M medias nueves, A almuerzo, O onces, C cena
        </div>
        {dates.map((date, i) => {
          const isToday = date === today;
          return (
            <div
              key={date}
              style={{
                padding: '14px 0 12px',
                borderBottom: i < dates.length - 1 ? '1px solid #E3DED3' : 'none',
                background: isToday ? '#F1EBDF' : 'transparent',
                margin: isToday ? '0 -24px' : 0,
                paddingLeft: isToday ? 24 : 0,
                paddingRight: isToday ? 24 : 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 18 }}>
                  {DAY_LABELS[i]} {date.slice(8)}
                </span>
                {isToday && (
                  <span style={{ fontSize: 11.5, fontWeight: 600, border: '1px solid #2B2724', borderRadius: 4, padding: '1px 7px' }}>
                    Hoy
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {ALL_SLOTS.map((slot) => {
                  const summary = summaryFor(findMeal(date, slot));
                  return (
                    <button
                      key={slot}
                      onClick={() => router.push(`/armar?date=${date}&slot=${slot}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', background: 'transparent', border: 'none', textAlign: 'left', minHeight: 44 }}
                    >
                      <span style={{ width: 14, fontSize: 11, fontWeight: 700, color: '#766F64', flexShrink: 0 }}>{slot}</span>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 13.5,
                          color: summary ? '#2B2724' : '#CFC8BA',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {summary || 'Sin asignar'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const navButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  border: '1px solid #2B2724',
  background: 'transparent',
  color: '#2B2724',
  fontSize: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
