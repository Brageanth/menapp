'use client';

import type { InventoryItem } from '@/domain/inventory';
import type { Recipe } from '@/domain/recipe';
import { SLOT_LABELS, missingIngredients } from '@/domain/recipe';

export function RecipeRow({
  recipe,
  inventory,
  onClick,
}: {
  recipe: Recipe;
  inventory?: InventoryItem[];
  onClick: () => void;
}) {
  const hasEverything = inventory ? missingIngredients(recipe, inventory).length === 0 : false;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '12px 0',
        borderBottom: '1px solid #E3DED3',
        width: '100%',
        textAlign: 'left',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          width: 50,
          height: 54,
          borderRadius: 5,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          boxShadow: 'inset 0 0 0 1px #CFC8BA',
          fontFamily: 'var(--font-young-serif), Georgia, serif',
          fontSize: 20,
          color: '#2B2724',
        }}
      >
        {SLOT_LABELS[recipe.slot][0]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{recipe.name}</div>
        <div style={{ fontSize: 12.5, color: '#766F64', marginTop: 1 }}>
          {SLOT_LABELS[recipe.slot]} · {recipe.prepTimeMinutes} min
        </div>
        {hasEverything && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2B2724" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span style={{ fontSize: 12.5, color: '#766F64' }}>Tienes todo</span>
          </div>
        )}
      </div>
    </button>
  );
}
