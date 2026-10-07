'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { menuRepo } from '@/data/repositories/menu-repo';
import { recipeRepo } from '@/data/repositories/recipe-repo';
import { inventoryRepo } from '@/data/repositories/inventory-repo';
import { shoppingListRepo } from '@/data/repositories/shopping-list-repo';
import type { MenuDay, GeneratedAssignment } from '@/domain/menu';
import { todayDate, toDateKey } from '@/domain/menu';
import type { MealSlot, Recipe } from '@/domain/recipe';
import { SLOT_LABELS } from '@/domain/recipe';
import type { InventoryItem } from '@/domain/inventory';
import { daysUntilExpiry, formatExpiryLabel } from '@/domain/inventory';
import type { ShoppingListItem } from '@/domain/shopping-list';
import { urgentShoppingItems } from '@/domain/shopping-list';

/** Sheets pesadas montadas solo al abrirse, igual patrón que /semana. */
const GenerarMenuSheet = dynamic(() => import('@/components/generar-menu-sheet').then((m) => m.GenerarMenuSheet));
const CompartirSheet = dynamic(() => import('@/components/compartir-sheet').then((m) => m.CompartirSheet));

const SLOTS: MealSlot[] = ['D', 'M', 'A', 'O', 'C'];

export default function HoyPage() {
  const router = useRouter();
  const [menuDays, setMenuDays] = useState<MenuDay[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingListItem[]>([]);
  const [today, setToday] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const refresh = useCallback(async () => {
    const [m, r, i, s] = await Promise.all([
      menuRepo.list(),
      recipeRepo.list(),
      inventoryRepo.list(),
      shoppingListRepo.list(),
    ]);
    setMenuDays(m);
    setRecipes(r);
    setInventory(i);
    setShoppingItems(s);
  }, []);

  useEffect(() => {
    setToday(todayDate());
    refresh().catch((err) => console.error('[hoy] list failed', err));
  }, [refresh]);

  const recipeMap = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const todayAssignments = useMemo(() => (today ? menuDays.filter((m) => m.date === today) : []), [menuDays, today]);

  const tomorrow = useMemo(() => {
    if (!today) return null;
    const [y, m, d] = today.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + 1);
    return toDateKey(date);
  }, [today]);

  const shoppingAlert = useMemo(() => {
    if (!today || !tomorrow) return null;
    const urgent = urgentShoppingItems(shoppingItems, menuDays, recipes, today, tomorrow);
    if (urgent.length === 0) return null;
    const names = urgent.slice(0, 2).map((i) => i.name);
    const rest = urgent.length - names.length;
    const itemsText = names.join(' y ') + (rest > 0 ? ` y ${rest} más` : '');
    const recipeNames = Array.from(new Set(urgent.map((i) => i.neededForRecipeName)));
    return {
      title: `Te falta${urgent.length === 1 ? '' : 'n'} ${itemsText}`,
      subtitle: `Para ${recipeNames.slice(0, 2).join(' y ')}.`,
    };
  }, [shoppingItems, menuDays, recipes, today, tomorrow]);

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

  async function handleApplyGenerated(assignments: GeneratedAssignment[]) {
    const updatedAt = new Date().toISOString();
    for (const a of assignments) {
      const existing = menuDays.find((m) => m.date === a.date && m.slot === a.slot);
      if (existing) {
        await menuRepo.update({ ...existing, recipeId: a.recipeId, updatedAt });
      } else {
        await menuRepo.add({ id: crypto.randomUUID(), date: a.date, slot: a.slot, recipeId: a.recipeId, updatedAt });
      }
    }
    setShowGenerate(false);
    refresh();
  }

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
        <div style={{ display: 'flex', gap: 8 }}>
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
          <button
            type="button"
            onClick={() => setShowShare(true)}
            aria-label="Compartir menú del día"
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              border: '1px solid var(--foreground)',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.6" y1="10.6" x2="15.4" y2="6.4" />
              <line x1="8.6" y1="13.4" x2="15.4" y2="17.6" />
            </svg>
          </button>
        </div>
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
          {SLOTS.map((slot, i) => {
            const assignment = todayAssignments.find((m) => m.slot === slot);
            const recipe = assignment?.recipeId ? recipeMap.get(assignment.recipeId) : null;
            return (
              <button
                key={slot}
                onClick={() => (recipe ? router.push(`/recetas/${recipe.id}`) : router.push('/semana'))}
                style={{
                  textAlign: 'left',
                  display: 'block',
                  padding: '17px 0',
                  borderBottom: i < SLOTS.length - 1 ? '1px solid var(--border)' : 'none',
                  background: 'transparent',
                }}
              >
                <div className="text-muted" style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                  {SLOT_LABELS[slot]}
                </div>
                <div className="font-serif" style={{ fontSize: 20, lineHeight: 1.22, color: recipe ? 'var(--foreground)' : 'var(--muted)' }}>
                  {recipe ? recipe.name : 'Sin asignar'}
                </div>
                {recipe && (
                  <div className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7, fontSize: 12.5 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {recipe.prepTimeMinutes} min
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button
            type="button"
            onClick={() => setShowGenerate(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
              padding: 14,
              borderRadius: 10,
              fontSize: 14.5,
              fontWeight: 600,
              flex: 1,
              background: 'transparent',
              color: 'var(--foreground)',
              border: '1px solid var(--foreground)',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
            Regenerar el día
          </button>
          <Link
            href="/semana"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
              padding: 14,
              borderRadius: 10,
              fontSize: 14.5,
              fontWeight: 600,
              flex: 1,
              background: 'var(--foreground)',
              color: 'var(--background)',
              border: '1px solid var(--foreground)',
            }}
          >
            Ver la semana
          </Link>
        </div>
      </div>

      {showGenerate && today && (
        <GenerarMenuSheet
          dates={[today]}
          recipes={recipes}
          inventory={inventory}
          profiles={[]}
          onApply={handleApplyGenerated}
          onClose={() => setShowGenerate(false)}
        />
      )}

      {showShare && today && (
        <CompartirSheet
          dates={[today]}
          today={today}
          menuDays={todayAssignments}
          recipes={recipes}
          shoppingItems={shoppingItems}
          initialTab="dia"
          allowedTabs={['dia']}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
