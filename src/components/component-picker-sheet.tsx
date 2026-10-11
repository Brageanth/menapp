'use client';

import { useMemo, useState } from 'react';
import type { Component, RoleId } from '@/domain/component';
import { filterComponents, SEED_ROLES } from '@/domain/component';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';

const ROLE_LABELS = new Map(SEED_ROLES.map((r) => [r.id, r.label]));

export function ComponentPickerSheet({
  components,
  suggestedRole,
  onPick,
  onClose,
}: {
  components: Component[];
  suggestedRole?: RoleId;
  onPick: (component: Component, quantity: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<RoleId | undefined>(suggestedRole);
  const [picked, setPicked] = useState<Component | null>(null);
  const [quantity, setQuantity] = useState('');

  useLockBodyScroll(onClose);

  const filtered = useMemo(() => filterComponents(components, { query, role }), [components, query, role]);

  function handleConfirm() {
    if (!picked) return;
    const qty = Number(quantity) || picked.portion.typical;
    onPick(picked, qty);
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, height: '100dvh', background: 'rgba(43,39,36,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', background: '#FAF8F4', borderRadius: '16px 16px 0 0', padding: '24px 24px calc(24px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '85dvh', overflowY: 'auto' }}
      >
        {!picked ? (
          <>
            <h2 style={{ fontSize: 22 }}>Agregar componente</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #2B2724', padding: '7px 2px' }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                placeholder="Buscar"
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#2B2724', flex: 1 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              <RoleChip label="Todos" active={!role} onClick={() => setRole(undefined)} />
              {SEED_ROLES.map((r) => (
                <RoleChip key={r.id} label={r.label} active={role === r.id} onClick={() => setRole(r.id)} />
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filtered.length === 0 && <p style={{ fontSize: 13, color: '#766F64', padding: '20px 0' }}>Nada coincide.</p>}
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setPicked(c);
                    setQuantity(String(c.portion.typical));
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 0', borderBottom: '1px solid #E3DED3', background: 'transparent', textAlign: 'left' }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#2B2724' }}>{c.name}</span>
                  <span style={{ fontSize: 12.5, color: '#766F64' }}>{c.roles.map((r) => ROLE_LABELS.get(r) ?? r).join(' · ')}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 22 }}>{picked.name}</h2>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64' }}>
              Cantidad ({picked.unit})
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                autoFocus
                style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid #2B2724', fontSize: 15, background: 'transparent', color: '#2B2724', fontFamily: 'inherit' }}
              />
            </label>
            <p style={{ fontSize: 12.5, color: '#766F64' }}>
              Rango habitual: {picked.portion.min}–{picked.portion.max} {picked.unit}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setPicked(null)}
                style={{ padding: 14, borderRadius: 10, background: 'transparent', color: '#2B2724', fontWeight: 600, fontSize: 14.5, border: '1px solid #E3DED3' }}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                style={{ flex: 1, padding: 14, borderRadius: 10, background: '#2B2724', color: '#FAF8F4', fontWeight: 600, fontSize: 14.5, border: 'none' }}
              >
                Agregar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RoleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 999, border: active ? '1px solid #2B2724' : '1px solid #E3DED3', background: active ? '#2B2724' : 'transparent', color: active ? '#FAF8F4' : '#766F64', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}
    >
      {label}
    </button>
  );
}
