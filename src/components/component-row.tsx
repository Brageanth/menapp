'use client';

import type { Component } from '@/domain/component';
import { SEED_ROLES } from '@/domain/component';

const ROLE_LABELS = new Map(SEED_ROLES.map((r) => [r.id, r.label]));

export function ComponentRow({ component, onClick }: { component: Component; onClick: () => void }) {
  const macrosLabel =
    component.macrosBasis === 'per100g'
      ? `${Math.round(component.macros.kcal)} kcal / 100${component.unit}`
      : `${Math.round(component.macros.kcal)} kcal / ${component.unit}`;

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 0',
        borderBottom: '1px solid #E3DED3',
        background: 'transparent',
        textAlign: 'left',
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {component.favorite && <span style={{ color: '#A8412B', fontSize: 13 }}>★</span>}
          <span style={{ fontSize: 15.5, fontWeight: 600, color: '#2B2724', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {component.name}
          </span>
          {component.isTreat && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: '#A8412B',
                border: '1px solid #A8412B',
                borderRadius: 999,
                padding: '1px 7px',
                flexShrink: 0,
              }}
            >
              gusto
            </span>
          )}
          {component.status === 'archived' && (
            <span style={{ fontSize: 10.5, color: '#766F64', border: '1px solid #E3DED3', borderRadius: 999, padding: '1px 7px', flexShrink: 0 }}>
              archivado
            </span>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: '#766F64' }}>
          {component.roles.map((r) => ROLE_LABELS.get(r) ?? r).join(' · ')}
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: '#766F64', flexShrink: 0, textAlign: 'right' }}>{macrosLabel}</div>
    </button>
  );
}
