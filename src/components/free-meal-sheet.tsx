'use client';

import { useState } from 'react';
import type { Macros } from '@/domain/component';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';

export function FreeMealSheet({
  onSave,
  onClose,
}: {
  onSave: (description: string, macros: Macros) => void;
  onClose: () => void;
}) {
  const [description, setDescription] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  useLockBodyScroll(onClose);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    onSave(description.trim(), { kcal: Number(kcal) || 0, protein: Number(protein) || 0, carbs: Number(carbs) || 0, fat: Number(fat) || 0 });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, height: '100dvh', background: 'rgba(43,39,36,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }} onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', background: '#FAF8F4', borderRadius: '16px 16px 0 0', padding: '24px 24px calc(24px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <h2 style={{ fontSize: 22 }}>Comida libre / fuera de casa</h2>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64' }}>
          Qué comiste
          <input value={description} onChange={(e) => setDescription(e.target.value)} autoFocus required style={inputStyle} />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={kcal} onChange={(e) => setKcal(e.target.value)} type="number" placeholder="kcal est." style={inputStyle} />
          <input value={protein} onChange={(e) => setProtein(e.target.value)} type="number" placeholder="prot" style={inputStyle} />
          <input value={carbs} onChange={(e) => setCarbs(e.target.value)} type="number" placeholder="carb" style={inputStyle} />
          <input value={fat} onChange={(e) => setFat(e.target.value)} type="number" placeholder="grasa" style={inputStyle} />
        </div>
        <button type="submit" style={{ padding: 14, borderRadius: 10, background: '#2B2724', color: '#FAF8F4', fontWeight: 600, fontSize: 14.5, border: 'none' }}>
          Registrar
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = { padding: '12px 14px', borderRadius: 8, border: '1px solid #2B2724', fontSize: 15, background: 'transparent', color: '#2B2724', fontFamily: 'inherit', flex: 1, minWidth: 0 };
