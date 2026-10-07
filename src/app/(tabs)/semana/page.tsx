'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { menuRepo } from '@/data/repositories/menu-repo';
import { recipeRepo } from '@/data/repositories/recipe-repo';
import { inventoryRepo } from '@/data/repositories/inventory-repo';
import { profileRepo } from '@/data/repositories/profile-repo';
import type { GeneratedAssignment, MenuDay } from '@/domain/menu';
import { startOfWeek, weekDates, varietySummary, todayDate } from '@/domain/menu';
import type { MealSlot, Recipe } from '@/domain/recipe';
import { SLOT_LABELS } from '@/domain/recipe';
import type { InventoryItem } from '@/domain/inventory';
import type { Profile } from '@/domain/profile';
import { deriveShoppingList } from '@/domain/shopping-list';
import { MenuSlotSheet } from '@/components/menu-slot-sheet';
import { GenerarMenuSheet } from '@/components/generar-menu-sheet';

const SLOTS: MealSlot[] = ['D', 'M', 'A', 'O', 'C'];
const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function SemanaPage() {
  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [menuDays, setMenuDays] = useState<MenuDay[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [active, setActive] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);

  const refresh = useCallback(async () => {
    const [m, r, i, p] = await Promise.all([
      menuRepo.list(),
      recipeRepo.list(),
      inventoryRepo.list(),
      profileRepo.list(),
    ]);
    setMenuDays(m);
    setRecipes(r);
    setInventory(i);
    setProfiles(p);
  }, []);

  useEffect(() => {
    setWeekStart(startOfWeek(new Date()));
    setToday(todayDate());
    refresh().catch((err) => console.error('[semana] list failed', err));
  }, [refresh]);

  const dates = useMemo(() => (weekStart ? weekDates(weekStart) : []), [weekStart]);
  const recipeMap = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  const weekMenuDays = useMemo(
    () => menuDays.filter((m) => dates.includes(m.date)),
    [menuDays, dates]
  );

  const variety = useMemo(() => varietySummary(weekMenuDays, recipes), [weekMenuDays, recipes]);
  const pendingShoppingCount = useMemo(
    () => deriveShoppingList(weekMenuDays, recipes, inventory).length,
    [weekMenuDays, recipes, inventory]
  );

  function findAssignment(date: string, slot: MealSlot): MenuDay | undefined {
    return menuDays.find((m) => m.date === date && m.slot === slot);
  }

  async function handleSelect(recipeId: string) {
    if (!active) return;
    const existing = findAssignment(active.date, active.slot);
    const updatedAt = new Date().toISOString();
    if (existing) {
      await menuRepo.update({ ...existing, recipeId, updatedAt });
    } else {
      await menuRepo.add({ id: crypto.randomUUID(), date: active.date, slot: active.slot, recipeId, updatedAt });
    }
    setActive(null);
    refresh();
  }

  async function handleClear() {
    if (!active) return;
    const existing = findAssignment(active.date, active.slot);
    if (existing) await menuRepo.remove(existing.id);
    setActive(null);
    refresh();
  }

  async function handleApplyGenerated(assignments: GeneratedAssignment[]) {
    const updatedAt = new Date().toISOString();
    for (const a of assignments) {
      const existing = findAssignment(a.date, a.slot);
      if (existing) {
        await menuRepo.update({ ...existing, recipeId: a.recipeId, updatedAt });
      } else {
        await menuRepo.add({ id: crypto.randomUUID(), date: a.date, slot: a.slot, recipeId: a.recipeId, updatedAt });
      }
    }
    setShowGenerate(false);
    refresh();
  }

  const activeAssignment = active ? findAssignment(active.date, active.slot) : undefined;
  const activeRecipe = activeAssignment?.recipeId ? recipeMap.get(activeAssignment.recipeId) ?? null : null;

  return (
    <div style={{ position: 'relative', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '26px 24px 16px', borderBottom: '1px solid #E3DED3', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 32 }}>Semana</h1>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={() => setShowGenerate(true)}
              style={{
                fontSize: 12.5,
                padding: '4px 10px',
                borderRadius: 999,
                border: '1px solid #2B2724',
                background: 'transparent',
                color: '#2B2724',
                fontWeight: 600,
              }}
            >
              Generar
            </button>
            <Link
              href="/compras"
              style={{
                fontSize: 12.5,
                padding: '4px 10px',
                borderRadius: 999,
                border: '1px solid #2B2724',
                color: pendingShoppingCount > 0 ? '#A8412B' : '#766F64',
              }}
            >
              Compras{pendingShoppingCount > 0 ? ` (${pendingShoppingCount})` : ''}
            </Link>
            <button
              aria-label="Semana anterior"
              onClick={() => setWeekStart((d) => { const n = new Date(d ?? startOfWeek(new Date())); n.setDate(n.getDate() - 7); return n; })}
              style={navButtonStyle}
            >
              ‹
            </button>
            <span style={{ fontSize: 13, color: '#766F64', minWidth: 90, textAlign: 'center' }}>
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
            {variety.repeatedRecipeIds.length > 0
              ? `${variety.repeatedRecipeIds.length} receta${variety.repeatedRecipeIds.length === 1 ? '' : 's'} repetida${variety.repeatedRecipeIds.length === 1 ? '' : 's'}`
              : 'Sin recetas repetidas'}
          </span>
          <span>
            {variety.distinctProteins} proteína{variety.distinctProteins === 1 ? '' : 's'} distinta{variety.distinctProteins === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflowX: 'auto', touchAction: 'pan-x' }}>
        <div style={{ display: 'flex', minWidth: '100%' }}>
          {dates.map((date, i) => (
            <div
              key={date}
              style={{
                flex: '1 0 130px',
                padding: '14px 10px',
                borderRight: i < 6 ? '1px solid #E3DED3' : 'none',
                background: date === today ? '#F1EBDF' : 'transparent',
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#2B2724', marginBottom: 10, textAlign: 'center' }}>
                {DAY_LABELS[i]} {date.slice(8)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SLOTS.map((slot) => {
                  const assignment = findAssignment(date, slot);
                  const recipe = assignment?.recipeId ? recipeMap.get(assignment.recipeId) : null;
                  return (
                    <button
                      key={slot}
                      onClick={() => setActive({ date, slot })}
                      style={{
                        textAlign: 'left',
                        padding: '8px 8px',
                        borderRadius: 8,
                        border: recipe ? '1px solid #2B2724' : '1px dashed #CFC8BA',
                        background: 'transparent',
                        minHeight: 48,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <span style={{ fontSize: 10.5, color: '#766F64' }}>{SLOT_LABELS[slot]}</span>
                      <span
                        style={{
                          fontSize: 12.5,
                          color: recipe ? '#2B2724' : '#CFC8BA',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {recipe ? recipe.name : '+'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {active && (
        <MenuSlotSheet
          slot={active.slot}
          recipes={recipes}
          current={activeRecipe}
          onSelect={handleSelect}
          onClear={handleClear}
          onClose={() => setActive(null)}
        />
      )}

      {showGenerate && (
        <GenerarMenuSheet
          dates={dates}
          recipes={recipes}
          inventory={inventory}
          profiles={profiles}
          onApply={handleApplyGenerated}
          onClose={() => setShowGenerate(false)}
        />
      )}
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
