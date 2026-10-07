'use client';

import { useRouter } from 'next/navigation';
import type { MealSlot, Recipe } from '@/domain/recipe';
import { SLOT_LABELS } from '@/domain/recipe';
import { RecipeRow } from './recipe-row';

export function MenuSlotSheet({
  slot,
  recipes,
  current,
  onSelect,
  onClear,
  onClose,
}: {
  slot: MealSlot;
  recipes: Recipe[];
  current: Recipe | null;
  onSelect: (recipeId: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const options = recipes.filter((r) => r.slot === slot);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(43,39,36,0.4)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 10,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          background: '#FAF8F4',
          borderRadius: '16px 16px 0 0',
          padding: '24px 24px calc(24px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          maxHeight: '75%',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ fontSize: 22 }}>{SLOT_LABELS[slot]}</h2>

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
