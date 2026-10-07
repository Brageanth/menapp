'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { menuRepo } from '@/data/repositories/menu-repo';
import { recipeRepo } from '@/data/repositories/recipe-repo';
import { inventoryRepo } from '@/data/repositories/inventory-repo';
import { profileRepo } from '@/data/repositories/profile-repo';
import { shoppingListRepo } from '@/data/repositories/shopping-list-repo';
import type { GeneratedAssignment, MenuDay } from '@/domain/menu';
import { startOfWeek, weekDates, varietySummary, todayDate } from '@/domain/menu';
import type { MealSlot, Recipe } from '@/domain/recipe';
import type { InventoryItem } from '@/domain/inventory';
import type { Profile } from '@/domain/profile';
import { deriveShoppingList } from '@/domain/shopping-list';
import type { ShoppingListItem } from '@/domain/shopping-list';
/** Las 3 sheets de esta pantalla solo se montan al abrirse — fuera del bundle inicial. */
const MenuSlotSheet = dynamic(() => import('@/components/menu-slot-sheet').then((m) => m.MenuSlotSheet));
const GenerarMenuSheet = dynamic(() => import('@/components/generar-menu-sheet').then((m) => m.GenerarMenuSheet));
const CompartirSheet = dynamic(() => import('@/components/compartir-sheet').then((m) => m.CompartirSheet));

const SLOTS: MealSlot[] = ['D', 'M', 'A', 'O', 'C'];
const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function SemanaPage() {
  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [menuDays, setMenuDays] = useState<MenuDay[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingListItem[]>([]);
  const [active, setActive] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const refresh = useCallback(async () => {
    const [m, r, i, p, s] = await Promise.all([
      menuRepo.list(),
      recipeRepo.list(),
      inventoryRepo.list(),
      profileRepo.list(),
      shoppingListRepo.list(),
    ]);
    setMenuDays(m);
    setRecipes(r);
    setInventory(i);
    setProfiles(p);
    setShoppingItems(s);
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
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '22px 24px 14px', borderBottom: '1px solid #E3DED3', display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h1 style={{ fontSize: 32 }}>Semana</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setShowShare(true)}
              style={{
                fontSize: 12.5,
                padding: '5px 12px',
                borderRadius: 999,
                border: '1px solid #E3DED3',
                background: 'transparent',
                color: '#766F64',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              Compartir
            </button>
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
          <button
            onClick={() => setShowGenerate(true)}
            style={{
              fontSize: 12.5,
              padding: '6px 12px',
              borderRadius: 999,
              border: '1px solid #2B2724',
              background: 'transparent',
              color: '#2B2724',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            Generar
          </button>
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
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      border: '1px solid #2B2724',
                      borderRadius: 4,
                      padding: '1px 7px',
                    }}
                  >
                    Hoy
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {SLOTS.map((slot) => {
                  const assignment = findAssignment(date, slot);
                  const recipe = assignment?.recipeId ? recipeMap.get(assignment.recipeId) : null;
                  return (
                    <button
                      key={slot}
                      onClick={() => setActive({ date, slot })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '7px 0',
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        minHeight: 44,
                      }}
                    >
                      <span style={{ width: 14, fontSize: 11, fontWeight: 700, color: '#766F64', flexShrink: 0 }}>
                        {slot}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 13.5,
                          color: recipe ? '#2B2724' : '#CFC8BA',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {recipe ? recipe.name : 'Sin asignar'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
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

      {showShare && (
        <CompartirSheet
          dates={dates}
          today={today}
          menuDays={weekMenuDays}
          recipes={recipes}
          shoppingItems={shoppingItems}
          onClose={() => setShowShare(false)}
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
