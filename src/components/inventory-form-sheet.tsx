'use client';

import { useState } from 'react';
import type { InventoryItem, InventoryLocation } from '@/domain/inventory';
import { canonicalAmount, UNIT_CHOICES } from '@/domain/quantity';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';

export interface InventoryFormValues {
  name: string;
  /** Siempre en la unidad canónica (g, ml, unidad) — el form convierte kg y L al guardar. */
  quantity: number;
  unit: string;
  unitWeight?: number | null;
  location: InventoryLocation;
  expiresAt: string | null;
}

/** Cómo mostrar lo guardado: 1500 g se edita como "1.5 kg", no como "1500 g". */
function initialAmount(item?: InventoryItem): { quantity: string; choice: string } {
  if (!item) return { quantity: '', choice: 'unidad' };
  const { quantity, unit } = canonicalAmount(item.quantity, item.unit);
  if (unit === 'g') return quantity >= 1000 ? { quantity: String(quantity / 1000), choice: 'kg' } : { quantity: String(quantity), choice: 'g' };
  if (unit === 'ml') return quantity >= 1000 ? { quantity: String(quantity / 1000), choice: 'l' } : { quantity: String(quantity), choice: 'ml' };
  return { quantity: String(quantity), choice: unit };
}

export function InventoryFormSheet({
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  initial?: InventoryItem;
  onSave: (values: InventoryFormValues) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const start = initialAmount(initial);
  const [quantity, setQuantity] = useState(start.quantity);
  const [unitChoice, setUnitChoice] = useState(start.choice);
  const [unitWeight, setUnitWeight] = useState(initial?.unitWeight ? String(initial.unitWeight) : '');
  const [location, setLocation] = useState<InventoryLocation>(initial?.location ?? 'nevera');
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ?? '');

  useLockBodyScroll(onClose);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const choice = UNIT_CHOICES.find((c) => c.id === unitChoice);
    const entered = Number(quantity) || 0;
    const weight = Number(unitWeight) || 0;
    const showsWeight = unitChoice === 'unidad';
    onSave({
      name: name.trim(),
      quantity: choice ? entered * choice.factor : entered,
      unit: choice ? choice.canonical : unitChoice,
      // Vacío borra el peso que había; fuera de "unidades" el peso guardado no se toca.
      ...(showsWeight && weight > 0 ? { unitWeight: weight } : showsWeight && initial?.unitWeight ? { unitWeight: null } : {}),
      location,
      expiresAt: expiresAt || null,
    });
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        height: '100dvh',
        background: 'rgba(43,39,36,0.4)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          background: '#FAF8F4',
          borderRadius: '16px 16px 0 0',
          padding: '24px 24px calc(24px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          maxHeight: '85dvh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ fontSize: 24 }}>{initial ? 'Editar producto' : 'Nuevo producto'}</h2>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64' }}>
          Nombre
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            style={inputStyle}
          />
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64', flex: 1 }}>
            Cantidad
            <input
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64', flex: 1 }}>
            Unidad
            <select value={unitChoice} onChange={(e) => setUnitChoice(e.target.value)} style={inputStyle}>
              {UNIT_CHOICES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
              {!UNIT_CHOICES.some((c) => c.id === unitChoice) && <option value={unitChoice}>{unitChoice}</option>}
            </select>
          </label>
        </div>

        {unitChoice === 'unidad' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64' }}>
            Peso por unidad en gramos (opcional)
            <input
              type="number"
              step="any"
              min="0"
              inputMode="decimal"
              value={unitWeight}
              onChange={(e) => setUnitWeight(e.target.value)}
              placeholder="ej. 200"
              style={inputStyle}
            />
            <span style={{ fontSize: 12 }}>Sirve para saber cuántos gramos tenés (3 aguacates de 200 g = 600 g).</span>
          </label>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64' }}>
          Ubicación
          <div style={{ display: 'flex', gap: 8 }}>
            {(['nevera', 'alacena'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setLocation(loc)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  border: location === loc ? '1px solid #2B2724' : '1px solid #E3DED3',
                  background: location === loc ? '#2B2724' : 'transparent',
                  color: location === loc ? '#FAF8F4' : '#2B2724',
                  fontSize: 14,
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }}
              >
                {loc}
              </button>
            ))}
          </div>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64' }}>
          Vence (opcional)
          <input
            type="date"
            value={expiresAt ?? ''}
            onChange={(e) => setExpiresAt(e.target.value)}
            style={inputStyle}
          />
        </label>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          {initial && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              style={{
                padding: 14,
                borderRadius: 10,
                background: 'transparent',
                color: '#A8412B',
                fontWeight: 600,
                fontSize: 14.5,
                border: '1px solid #A8412B',
              }}
            >
              Eliminar
            </button>
          )}
          <button
            type="submit"
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 10,
              background: '#2B2724',
              color: '#FAF8F4',
              fontWeight: 600,
              fontSize: 14.5,
              border: 'none',
            }}
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 8,
  border: '1px solid #2B2724',
  fontSize: 15,
  background: 'transparent',
  color: '#2B2724',
  fontFamily: 'inherit',
};
