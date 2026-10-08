'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GeneratedAssignment } from '@/domain/menu';
import { sanitizeGeneratedMenu } from '@/domain/menu';
import type { MealSlot, Recipe } from '@/domain/recipe';
import { SLOT_LABELS, isInLibrary } from '@/domain/recipe';
import type { InventoryItem } from '@/domain/inventory';
import { RecipeRow } from './recipe-row';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';

export function MenuSlotSheet({
  date,
  slot,
  recipes,
  inventory,
  current,
  onSelect,
  onClear,
  onApplyGenerated,
  onClose,
}: {
  date: string;
  slot: MealSlot;
  recipes: Recipe[];
  inventory: InventoryItem[];
  current: Recipe | null;
  onSelect: (recipeId: string) => void;
  onClear: () => void;
  onApplyGenerated: (assignments: GeneratedAssignment[]) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const options = recipes.filter((r) => r.slot === slot);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  useLockBodyScroll(onClose);

  async function handleRegenerate() {
    if (offline || regenerating) return;
    setRegenerating(true);
    setRegenerateError(null);
    try {
      const res = await fetch('/api/generate-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dates: [date],
          onlySlot: slot,
          recipes: recipes.filter(isInLibrary).map((r) => ({
            id: r.id,
            name: r.name,
            slot: r.slot,
            proteinTag: r.proteinTag,
            caloriesPerServing: r.caloriesPerServing,
            ingredients: r.ingredients.map((i) => ({ name: i.name })),
          })),
          inventory: inventory.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, expiresAt: i.expiresAt })),
          rules: {
            prioritizeLibrary: true,
            useExpiringFirst: true,
            varietyFocus: false,
            useGoals: false,
            includeMidMeals: true,
            mode: 'permitir-compras',
          },
          goals: null,
        }),
      });
      const data = (await res.json()) as { assignments?: GeneratedAssignment[]; error?: string };
      if (!res.ok) {
        setRegenerateError(data.error ?? 'No se pudo regenerar este plato.');
        return;
      }
      const clean = sanitizeGeneratedMenu(data.assignments ?? [], recipes, [date]).filter((a) => a.slot === slot);
      if (clean.length === 0) {
        setRegenerateError('No se pudo armar una opción para este plato. Probá de nuevo.');
        return;
      }
      onApplyGenerated(clean);
    } catch {
      setRegenerateError('No se pudo regenerar. Revisá tu conexión.');
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        height: '100dvh',
        background: 'rgba(43,39,36,0.4)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 50,
      }}
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
          maxHeight: '75dvh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <h2 style={{ fontSize: 22 }}>{SLOT_LABELS[slot]}</h2>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={offline || regenerating}
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: '9px 14px',
              borderRadius: 999,
              border: '1px solid #2B2724',
              background: regenerating ? '#E3DED3' : 'transparent',
              color: '#2B2724',
              whiteSpace: 'nowrap',
            }}
          >
            {regenerating ? 'Pensando…' : 'Regenerar con IA'}
          </button>
        </div>

        {offline && <p style={{ fontSize: 12.5, color: '#A8412B' }}>Necesitás conexión para regenerar con IA.</p>}
        {regenerateError && <p style={{ fontSize: 12.5, color: '#A8412B' }}>{regenerateError}</p>}

        {current && (
          <button
            type="button"
            onClick={() => router.push(`/recetas/${current.id}`)}
            style={{
              alignSelf: 'flex-start',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'underline',
              textUnderlineOffset: 4,
              background: 'transparent',
              border: 'none',
              color: '#2B2724',
              padding: '2px 0',
            }}
          >
            Ver receta asignada{current.inLibrary === false ? ' (sin guardar en Biblioteca)' : ''} →
          </button>
        )}

        {options.length > 0 ? (
          <div>
            {options.map((r) => (
              <RecipeRow key={r.id} recipe={r} onClick={() => onSelect(r.id)} />
            ))}
          </div>
        ) : (
          <div style={{ padding: '24px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <p style={{ fontSize: 14, color: '#766F64' }}>
              No tenés recetas de {SLOT_LABELS[slot].toLowerCase()}.
            </p>
            <button
              onClick={() => router.push('/recetas')}
              style={{
                padding: '12px 20px',
                borderRadius: 10,
                background: '#2B2724',
                color: '#FAF8F4',
                fontWeight: 600,
                fontSize: 14,
                border: 'none',
              }}
            >
              Ir a Recetas
            </button>
          </div>
        )}

        {current && (
          <button
            onClick={onClear}
            style={{
              padding: 14,
              borderRadius: 10,
              background: 'transparent',
              color: '#A8412B',
              fontWeight: 600,
              fontSize: 14.5,
              border: '1px solid #A8412B',
            }}
          >
            Quitar receta asignada
          </button>
        )}
      </div>
    </div>
  );
}
