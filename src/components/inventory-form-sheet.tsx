'use client';

import { useState } from 'react';
import type { InventoryItem, InventoryLocation } from '@/domain/inventory';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';

export interface InventoryFormValues {
  name: string;
  quantity: number;
  unit: string;
  location: InventoryLocation;
  expiresAt: string | null;
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
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? ''));
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [location, setLocation] = useState<InventoryLocation>(initial?.location ?? 'nevera');
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ?? '');

  useLockBodyScroll(onClose);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      quantity: Number(quantity) || 0,
      unit: unit.trim(),
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
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="g, unidades, L…"
              style={inputStyle}
            />
          </label>
        </div>

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
