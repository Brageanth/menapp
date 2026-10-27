'use client';

import { useState } from 'react';
import type { Component } from '@/domain/component';
import { formatQuantity, macrosForQuantity, portionLooksLikeCount } from '@/domain/component';
import type { MealComponentEntry } from '@/domain/meal-assembly';

const iconButton: React.CSSProperties = { background: 'none', border: 'none', padding: 6, fontSize: 14, color: '#766F64', minWidth: 40, minHeight: 40 };

/**
 * Una fila de la comida. Cerrada solo muestra lo esencial (qué es, cuánto y qué aporta); al tocarla
 * se abren los controles (cantidad, fijar, cambiar, calificar, quitar) para no cargar la pantalla.
 * Separa lo que se SIRVE (cantidad) de lo que APORTA (macros de esa cantidad).
 */
export function MealEntryRow({
  entry,
  component,
  roleCaption,
  score,
  onQuantity,
  onToggleLock,
  onRate,
  onSwap,
  onRemove,
}: {
  entry: MealComponentEntry;
  component: Component;
  /** Rol que cumple en la comida ("Proteína") — pequeño, sobre el nombre. */
  roleCaption?: string;
  score: number;
  onQuantity: (quantity: number) => void;
  onToggleLock: () => void;
  onRate: (delta: 1 | -1) => void;
  onSwap: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { min, max, step } = component.portion;
  const macros = macrosForQuantity(component, entry.quantity);
  const suspicious = portionLooksLikeCount(component);
  const clamp = (q: number) => Math.max(min, Math.min(max, Math.round(q * 100) / 100));

  return (
    <div style={{ borderBottom: '1px solid #E3DED3' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 0', background: 'none', border: 'none', textAlign: 'left', minHeight: 56 }}
      >
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {roleCaption && <span style={{ fontSize: 11.5, color: '#766F64', letterSpacing: 0.2 }}>{roleCaption}</span>}
          <span style={{ fontSize: 16, fontWeight: 600, color: '#2B2724' }}>
            {component.name}
            {entry.locked && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: '#A8412B' }}>Fija</span>}
          </span>
          <span style={{ fontSize: 12.5, color: '#766F64', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(macros.protein)} g prot · {Math.round(macros.kcal)} kcal
          </span>
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#2B2724', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          {formatQuantity(component, entry.quantity)}
        </span>
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E3DED3', borderRadius: 8 }}>
              <button
                type="button"
                className="press"
                onClick={() => onQuantity(clamp(entry.quantity - step))}
                disabled={entry.quantity <= min}
                aria-label={`Menos ${component.name}`}
                style={{ ...iconButton, color: '#2B2724', fontSize: 18, opacity: entry.quantity <= min ? 0.3 : 1 }}
              >
                −
              </button>
              <span style={{ minWidth: 72, textAlign: 'center', fontSize: 13.5, fontWeight: 600, color: '#2B2724', fontVariantNumeric: 'tabular-nums' }}>
                {formatQuantity(component, entry.quantity)}
              </span>
              <button
                type="button"
                className="press"
                onClick={() => onQuantity(clamp(entry.quantity + step))}
                disabled={entry.quantity >= max}
                aria-label={`Más ${component.name}`}
                style={{ ...iconButton, color: '#2B2724', fontSize: 18, opacity: entry.quantity >= max ? 0.3 : 1 }}
              >
                +
              </button>
            </div>
            <span style={{ flex: 1, fontSize: 12, color: '#766F64', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
              {Math.round(macros.carbs)} g carb · {Math.round(macros.fat)} g grasa
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <button type="button" className="press" onClick={onSwap} style={{ ...iconButton, color: '#2B2724', fontWeight: 600, fontSize: 13, paddingLeft: 0 }}>
              Cambiar por otro
            </button>
            <button
              type="button"
              className="press"
              onClick={onToggleLock}
              aria-pressed={entry.locked}
              style={{ ...iconButton, color: entry.locked ? '#A8412B' : '#766F64', fontSize: 13 }}
            >
              {entry.locked ? 'Quitar fijo' : 'Fijar'}
            </button>
            <span style={{ flex: 1 }} />
            <button type="button" className="press" onClick={() => onRate(1)} aria-label="Me gustó" style={{ ...iconButton, opacity: score > 0 ? 1 : 0.35 }}>
              👍
            </button>
            <button type="button" className="press" onClick={() => onRate(-1)} aria-label="No tanto" style={{ ...iconButton, opacity: score < 0 ? 1 : 0.35 }}>
              👎
            </button>
            <button type="button" className="press" onClick={onRemove} aria-label={`Quitar ${component.name}`} style={{ ...iconButton, color: '#A8412B' }}>
              Quitar
            </button>
          </div>

          {suspicious && (
            <div style={{ fontSize: 12, color: '#A8412B', background: 'rgba(168,65,43,0.08)', borderRadius: 8, padding: '6px 10px' }}>
              Macros dudosos: está medido por 100 g pero se sirve por unidad. Editá el componente y elegí &ldquo;Por unidad entera&rdquo;.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
