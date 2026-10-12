'use client';

import { useState } from 'react';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';

export function GenerateWeekSheet({
  hasGoal,
  onGenerate,
  onClose,
}: {
  hasGoal: boolean;
  onGenerate: (useGoal: boolean) => void;
  onClose: () => void;
}) {
  const [useGoal, setUseGoal] = useState(hasGoal);

  useLockBodyScroll(onClose);

  return (
    <div style={{ position: 'fixed', inset: 0, height: '100dvh', background: 'rgba(43,39,36,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', background: '#FAF8F4', borderRadius: '16px 16px 0 0', padding: '24px 24px calc(24px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <h2 style={{ fontSize: 24 }}>Generar menú</h2>
        <p style={{ fontSize: 13, color: '#766F64', marginTop: -6 }}>
          Completa los 7 días con componentes, priorizando lo que vence, tus macros y variedad —
          cada comida queda editable en Armar después.
        </p>

        {hasGoal && (
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 2px', borderBottom: '1px solid #E3DED3' }}>
            <span style={{ fontSize: 14, color: '#2B2724' }}>Tener en cuenta tu meta de kcal</span>
            <input type="checkbox" checked={useGoal} onChange={(e) => setUseGoal(e.target.checked)} />
          </label>
        )}

        <p style={{ fontSize: 12, color: '#A8412B' }}>Esto reemplaza lo que ya tengas armado esta semana.</p>

        <button
          type="button"
          onClick={() => onGenerate(useGoal)}
          style={{ padding: 14, borderRadius: 10, background: '#2B2724', color: '#FAF8F4', fontWeight: 600, fontSize: 14.5, border: 'none' }}
        >
          Generar semana
        </button>
      </div>
    </div>
  );
}
