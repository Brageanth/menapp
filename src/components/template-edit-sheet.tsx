'use client';

import { useState } from 'react';
import { SEED_ROLES, type RoleId } from '@/domain/component';
import type { MealTemplate, TemplateSlot } from '@/domain/meal-template';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';

type SlotState = 'off' | 'optional' | 'required';

export function TemplateEditSheet({
  template,
  onSave,
  onClose,
}: {
  template: MealTemplate;
  onSave: (slots: TemplateSlot[]) => void;
  onClose: () => void;
}) {
  const initialState = new Map<RoleId, SlotState>(
    SEED_ROLES.map((r) => {
      const existing = template.slots.find((s) => s.role === r.id);
      return [r.id, existing ? (existing.required ? 'required' : 'optional') : 'off'];
    })
  );
  const [state, setState] = useState(initialState);

  useLockBodyScroll(onClose);

  function cycle(role: RoleId) {
    setState((prev) => {
      const next = new Map(prev);
      const current = prev.get(role) ?? 'off';
      const order: SlotState[] = ['off', 'optional', 'required'];
      next.set(role, order[(order.indexOf(current) + 1) % order.length]);
      return next;
    });
  }

  function handleSave() {
    const slots: TemplateSlot[] = [];
    let order = 0;
    for (const r of SEED_ROLES) {
      const value = state.get(r.id) ?? 'off';
      if (value === 'off') continue;
      slots.push({ id: `${template.slot}-${r.id}`, role: r.id, required: value === 'required', order: order++ });
    }
    onSave(slots);
  }

  const LABEL: Record<SlotState, string> = { off: 'No incluido', optional: 'Opcional', required: 'Obligatorio' };
  const COLOR: Record<SlotState, string> = { off: '#766F64', optional: '#2B2724', required: '#A8412B' };

  return (
    <div style={{ position: 'fixed', inset: 0, height: '100dvh', background: 'rgba(43,39,36,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', background: '#FAF8F4', borderRadius: '16px 16px 0 0', padding: '24px 24px calc(24px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '85dvh', overflowY: 'auto' }}
      >
        <h2 style={{ fontSize: 22 }}>Editar plantilla</h2>
        <p style={{ fontSize: 12.5, color: '#766F64' }}>Tocá un rol para ciclar: no incluido → opcional → obligatorio.</p>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {SEED_ROLES.map((r) => {
            const value = state.get(r.id) ?? 'off';
            return (
              <button
                key={r.id}
                onClick={() => cycle(r.id)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #E3DED3', background: 'transparent' }}
              >
                <span style={{ fontSize: 15, color: '#2B2724' }}>{r.label}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: COLOR[value] }}>{LABEL[value]}</span>
              </button>
            );
          })}
        </div>
        <button onClick={handleSave} style={{ padding: 14, borderRadius: 10, background: '#2B2724', color: '#FAF8F4', fontWeight: 600, fontSize: 14.5, border: 'none' }}>
          Guardar plantilla
        </button>
      </div>
    </div>
  );
}
