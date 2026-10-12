'use client';

import { useState } from 'react';
import type { SavedPlate } from '@/domain/saved-plate';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';

export function SavedPlateSheet({
  plates,
  onPick,
  onSaveCurrentAsNew,
  onClose,
}: {
  plates: SavedPlate[];
  onPick: (plate: SavedPlate) => void;
  onSaveCurrentAsNew: (name: string) => void;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState('');

  useLockBodyScroll(onClose);

  return (
    <div style={{ position: 'fixed', inset: 0, height: '100dvh', background: 'rgba(43,39,36,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', background: '#FAF8F4', borderRadius: '16px 16px 0 0', padding: '24px 24px calc(24px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '85dvh', overflowY: 'auto' }}
      >
        <h2 style={{ fontSize: 22 }}>Platos guardados</h2>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {plates.length === 0 && <p style={{ fontSize: 13, color: '#766F64', padding: '10px 0' }}>Todavía no hay platos guardados para esta comida.</p>}
          {plates.map((p) => (
            <button key={p.id} onClick={() => onPick(p)} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #E3DED3', background: 'transparent', textAlign: 'left' }}>
              <span style={{ fontSize: 15, color: '#2B2724' }}>{p.name}</span>
              <span style={{ fontSize: 12.5, color: '#766F64' }}>{p.entries.length} componentes</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #E3DED3', paddingTop: 14 }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Guardar la comida actual como…"
            style={{ flex: 1, padding: '12px 14px', borderRadius: 8, border: '1px solid #2B2724', fontSize: 14, background: 'transparent', color: '#2B2724', fontFamily: 'inherit' }}
          />
          <button
            onClick={() => newName.trim() && onSaveCurrentAsNew(newName.trim())}
            disabled={!newName.trim()}
            style={{ padding: '0 16px', borderRadius: 8, border: 'none', background: '#2B2724', color: '#FAF8F4', fontWeight: 600, fontSize: 13.5 }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
