'use client';

import type { Suggestion } from '@/domain/suggestion';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';

export function SuggestionSheet({
  suggestions,
  onPick,
  onClose,
}: {
  suggestions: Suggestion[];
  onPick: (suggestion: Suggestion) => void;
  onClose: () => void;
}) {
  useLockBodyScroll(onClose);

  return (
    <div style={{ position: 'fixed', inset: 0, height: '100dvh', background: 'rgba(43,39,36,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', background: '#FAF8F4', borderRadius: '16px 16px 0 0', padding: '24px 24px calc(24px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '85dvh', overflowY: 'auto' }}
      >
        <h2 style={{ fontSize: 22 }}>Sugerencias</h2>
        {suggestions.length === 0 && <p style={{ fontSize: 13, color: '#766F64', padding: '10px 0' }}>No hay candidatos disponibles para este rol.</p>}
        {suggestions.map((s) => (
          <button
            key={s.component.id}
            onClick={() => onPick(s)}
            style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 0', borderBottom: '1px solid #E3DED3', background: 'transparent', textAlign: 'left' }}
          >
            <span style={{ fontSize: 15, fontWeight: 600, color: '#2B2724' }}>{s.component.name}</span>
            <span style={{ fontSize: 12.5, color: '#766F64' }}>{s.reason}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
