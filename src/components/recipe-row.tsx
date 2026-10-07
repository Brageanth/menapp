'use client';

import type { Recipe } from '@/domain/recipe';
import { SLOT_LABELS } from '@/domain/recipe';

export function RecipeRow({ recipe, onClick }: { recipe: Recipe; onClick: () => void }) {
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
      </div>
    </button>
  );
}
