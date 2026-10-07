'use client';

import { useState } from 'react';
import type { GeneratedAssignment, MenuGenerationRules } from '@/domain/menu';
import { sanitizeGeneratedMenu } from '@/domain/menu';
import type { Recipe } from '@/domain/recipe';
import type { InventoryItem } from '@/domain/inventory';
import type { Profile } from '@/domain/profile';
import { SLOT_KCAL_WEIGHTS, type MealSlot } from '@/domain/recipe';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';

interface GoalInput {
  personLabel: Profile['personLabel'];
  kcalTarget: number;
  slotBudgets: Record<MealSlot, number>;
}

/** Traduce metas diarias en un presupuesto real de kcal por slot (ver SLOT_KCAL_WEIGHTS) — F6 pasa números, no solo texto. */
function goalsInput(profiles: Profile[]): GoalInput[] {
  return profiles
    .filter((p): p is Profile & { kcalTarget: number } => !!p.kcalTarget)
    .map((p) => ({
      personLabel: p.personLabel,
      kcalTarget: p.kcalTarget,
      slotBudgets: Object.fromEntries(
        (Object.keys(SLOT_KCAL_WEIGHTS) as MealSlot[]).map((slot) => [slot, Math.round(p.kcalTarget * SLOT_KCAL_WEIGHTS[slot])])
      ) as Record<MealSlot, number>,
    }));
}

export function GenerarMenuSheet({
  dates,
  recipes,
  inventory,
  profiles,
  onApply,
  onClose,
}: {
  dates: string[];
  recipes: Recipe[];
  inventory: InventoryItem[];
  profiles: Profile[];
  onApply: (assignments: GeneratedAssignment[]) => void;
  onClose: () => void;
}) {
  const [rules, setRules] = useState<MenuGenerationRules>({
    prioritizeLibrary: true,
    useExpiringFirst: true,
    varietyFocus: true,
    useGoals: false,
    includeMidMeals: false,
    mode: 'solo-despensa',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  useLockBodyScroll(onClose);

  function toggle(key: keyof Omit<MenuGenerationRules, 'mode'>) {
    setRules((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleGenerate() {
    if (offline || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/generate-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dates,
          recipes: recipes.map((r) => ({
            id: r.id,
            name: r.name,
            slot: r.slot,
            proteinTag: r.proteinTag,
            caloriesPerServing: r.caloriesPerServing,
            ingredients: r.ingredients.map((i) => ({ name: i.name })),
          })),
          inventory: inventory.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, expiresAt: i.expiresAt })),
          rules,
          goals: rules.useGoals ? goalsInput(profiles) : null,
        }),
      });
      if (!res.ok) throw new Error('fallo la generación');
      const data = (await res.json()) as { assignments: GeneratedAssignment[] };
      const clean = sanitizeGeneratedMenu(data.assignments ?? [], recipes, dates);
      if (clean.length === 0) {
        setError('No se pudo armar un menú con la biblioteca actual. Agregá más recetas o cambiá las reglas.');
        return;
      }
      onApply(clean);
    } catch {
      setError('No se pudo generar el menú. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, height: '100dvh', background: 'rgba(43,39,36,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }}
      onClick={onClose}
    >
      <div
        role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          background: '#FAF8F4',
          borderRadius: '16px 16px 0 0',
          padding: '24px 24px calc(24px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          maxHeight: '85dvh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ fontSize: 24 }}>Generar menú</h2>
        <p style={{ fontSize: 13, color: '#766F64', marginTop: -6 }}>
          Claude arma la semana con tu biblioteca y despensa actuales.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ToggleRow label="Priorizar biblioteca" checked={rules.prioritizeLibrary} onClick={() => toggle('prioritizeLibrary')} />
          <ToggleRow label="Usar lo que vence primero" checked={rules.useExpiringFirst} onClick={() => toggle('useExpiringFirst')} />
          <ToggleRow label="Priorizar variedad" checked={rules.varietyFocus} onClick={() => toggle('varietyFocus')} />
          <ToggleRow label="Tener en cuenta metas nutricionales" checked={rules.useGoals} onClick={() => toggle('useGoals')} />
          <ToggleRow label="Incluir medias mañanas y onces" checked={rules.includeMidMeals} onClick={() => toggle('includeMidMeals')} />
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64' }}>
          Modo
          <div style={{ display: 'flex', gap: 6 }}>
            {(
              [
                { value: 'solo-despensa', label: 'Solo despensa' },
                { value: 'permitir-compras', label: 'Permitir compras' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRules((prev) => ({ ...prev, mode: opt.value }))}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: 8,
                  border: rules.mode === opt.value ? '1px solid #2B2724' : '1px solid #E3DED3',
                  background: rules.mode === opt.value ? '#2B2724' : 'transparent',
                  color: rules.mode === opt.value ? '#FAF8F4' : '#2B2724',
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </label>

        {offline && (
          <p style={{ fontSize: 13, color: '#A8412B' }}>Necesitás conexión para generar el menú.</p>
        )}
        {error && <p style={{ fontSize: 13, color: '#A8412B' }}>{error}</p>}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={offline || loading}
          style={{
            padding: 14,
            borderRadius: 10,
            background: offline || loading ? '#CFC8BA' : '#2B2724',
            color: '#FAF8F4',
            fontWeight: 600,
            fontSize: 14.5,
            border: 'none',
          }}
        >
          {loading ? 'Generando…' : 'Generar'}
        </button>
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 2px',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid #E3DED3',
      }}
    >
      <span style={{ fontSize: 14, color: '#2B2724', textAlign: 'left' }}>{label}</span>
      <span
        aria-hidden
        style={{
          width: 40,
          height: 24,
          borderRadius: 999,
          background: checked ? '#2B2724' : '#E3DED3',
          position: 'relative',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#FAF8F4',
            transition: 'left 0.15s',
          }}
        />
      </span>
    </button>
  );
}
