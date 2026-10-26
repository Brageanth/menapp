'use client';

import type { Component } from '@/domain/component';
import { formatQuantity, macrosForQuantity, portionLooksLikeCount } from '@/domain/component';
import type { MealComponentEntry } from '@/domain/meal-assembly';

const iconButton: React.CSSProperties = { background: 'none', border: 'none', padding: 6, fontSize: 14, color: '#766F64', minWidth: 32, minHeight: 32 };

/**
 * Una fila de la comida. Separa lo que se SIRVE (cantidad, editable con −/+ de a un salto) de lo que
 * APORTA (macros de esa cantidad) para que no se confundan "200 g de churrasco" y "46 g de proteína".
 */
export function MealEntryRow({
  entry,
  component,
  score,
  onQuantity,
  onToggleLock,
  onRate,
  onRemove,
}: {
  entry: MealComponentEntry;
  component: Component;
  score: number;
  onQuantity: (quantity: number) => void;
  onToggleLock: () => void;
  onRate: (delta: 1 | -1) => void;
  onRemove: () => void;
}) {
  const { min, max, step } = component.portion;
  const macros = macrosForQuantity(component, entry.quantity);
  const suspicious = portionLooksLikeCount(component);
  const clamp = (q: number) => Math.max(min, Math.min(max, Math.round(q * 100) / 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 0', borderBottom: '1px solid #E3DED3' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: '#2B2724' }}>{component.name}</span>
        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E3DED3', borderRadius: 8 }}>
          <button
            type="button"
            onClick={() => onQuantity(clamp(entry.quantity - step))}
            disabled={entry.quantity <= min}
            aria-label={`Menos ${component.name}`}
            style={{ ...iconButton, color: '#2B2724', opacity: entry.quantity <= min ? 0.3 : 1 }}
          >
            −
          </button>
          <span style={{ minWidth: 64, textAlign: 'center', fontSize: 13.5, fontWeight: 600, color: '#2B2724', fontVariantNumeric: 'tabular-nums' }}>
            {formatQuantity(component, entry.quantity)}
          </span>
          <button
            type="button"
            onClick={() => onQuantity(clamp(entry.quantity + step))}
            disabled={entry.quantity >= max}
            aria-label={`Más ${component.name}`}
            style={{ ...iconButton, color: '#2B2724', opacity: entry.quantity >= max ? 0.3 : 1 }}
          >
            +
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ flex: 1, fontSize: 12.5, color: '#766F64', fontVariantNumeric: 'tabular-nums' }}>
          aporta {Math.round(macros.protein)} g prot · {Math.round(macros.carbs)} g carb · {Math.round(macros.fat)} g grasa · {Math.round(macros.kcal)} kcal
        </span>
        <button type="button" onClick={onToggleLock} aria-label={entry.locked ? 'Quitar candado' : 'Fijar cantidad'} style={{ ...iconButton, color: entry.locked ? '#A8412B' : '#766F64', fontSize: 12.5 }}>
          {entry.locked ? 'Fija' : 'Fijar'}
        </button>
        <button type="button" onClick={() => onRate(1)} aria-label="Me gustó" style={{ ...iconButton, opacity: score > 0 ? 1 : 0.35 }}>
          👍
        </button>
        <button type="button" onClick={() => onRate(-1)} aria-label="No tanto" style={{ ...iconButton, opacity: score < 0 ? 1 : 0.35 }}>
          👎
        </button>
        <button type="button" onClick={onRemove} aria-label={`Quitar ${component.name}`} style={iconButton}>
          ✕
        </button>
      </div>

      {suspicious && (
        <div style={{ fontSize: 12, color: '#A8412B', background: 'rgba(168,65,43,0.08)', borderRadius: 8, padding: '6px 10px' }}>
          Macros dudosos: está medido por 100 g pero se sirve por unidad. Editá el componente y elegí &ldquo;Por unidad entera&rdquo;.
        </div>
      )}
    </div>
  );
}
