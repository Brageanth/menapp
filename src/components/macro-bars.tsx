'use client';

import type { Macros } from '@/domain/component';
import type { MacroTarget } from '@/domain/meal-sizing';

const ROWS: { key: keyof Macros; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calorías', unit: 'kcal' },
  { key: 'protein', label: 'Proteína', unit: 'g' },
  { key: 'carbs', label: 'Carbohidratos', unit: 'g' },
  { key: 'fat', label: 'Grasa', unit: 'g' },
];

/** Una barra por macro: lo consumido contra la meta (si hay). La proteína es piso: pasarse no se marca como error. */
export function MacroBars({ totals, target, title }: { totals: Macros; target: MacroTarget | null; title: string }) {
  return (
    <section aria-label={title} style={{ border: '1px solid #E3DED3', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: '#766F64', fontFamily: 'inherit' }}>{title}</h2>
      {ROWS.map(({ key, label, unit }) => {
        const goal = target?.[key] ?? null;
        const value = totals[key];
        const ratio = goal ? Math.min(value / goal, 1) : 0;
        const over = goal != null && key !== 'protein' && value > goal * 1.1;
        return (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#2B2724' }}>
              <span>{label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: over ? '#A8412B' : '#2B2724' }}>
                {Math.round(value)}
                {goal != null && <span style={{ color: '#766F64' }}> / {Math.round(goal)}</span>} {unit}
              </span>
            </div>
            {goal != null && (
              <div style={{ height: 4, borderRadius: 2, background: '#E3DED3', overflow: 'hidden' }}>
                <div style={{ width: `${ratio * 100}%`, height: '100%', background: over ? '#A8412B' : '#3F7D4F', transition: 'width 200ms cubic-bezier(0.23, 1, 0.32, 1)' }} />
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
