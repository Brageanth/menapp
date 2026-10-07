'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { receiptRepo } from '@/data/repositories/receipt-repo';
import { inventoryRepo } from '@/data/repositories/inventory-repo';
import type { Receipt, ReceiptItem } from '@/domain/receipt';

const CONFIDENCE_COLOR: Record<ReceiptItem['confidence'], string> = {
  alta: '#3B7A3B',
  media: '#A8792B',
  baja: '#A8412B',
};

export default function ConfirmarCapturaPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24, fontSize: 14, color: '#766F64' }}>Cargando…</p>}>
      <ConfirmarCapturaContent />
    </Suspense>
  );
}

function ConfirmarCapturaContent() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get('id');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const receiptId = id;
    let ignore = false;

    async function poll() {
      const r = await receiptRepo.get(receiptId);
      if (ignore || !r) return;
      setReceipt(r);
      setItems(r.items);
      return r.status;
    }

    poll();
    const interval = setInterval(async () => {
      const status = await poll();
      if (status === 'needs_review' || status === 'confirmed') clearInterval(interval);
    }, 2000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [id]);

  function updateItem(index: number, patch: Partial<ReceiptItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleConfirm() {
    if (!receipt) return;
    setSaving(true);
    const now = new Date().toISOString();
    for (const item of items) {
      await inventoryRepo.add({
        id: crypto.randomUUID(),
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        location: 'alacena',
        expiresAt: null,
        updatedAt: now,
      });
    }
    await receiptRepo.update({ ...receipt, items, status: 'confirmed' });
    router.push('/despensa');
  }

  if (!id) return <p style={{ padding: 24, fontSize: 14, color: '#766F64' }}>Falta la foto.</p>;
  if (!receipt) return <p style={{ padding: 24, fontSize: 14, color: '#766F64' }}>Cargando…</p>;

  if (receipt.status === 'pending_upload') {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h1 style={{ fontSize: 24 }}>Pendiente de conexión</h1>
        <p style={{ fontSize: 14, color: '#766F64' }}>
          La foto quedó guardada en el dispositivo. Se va a subir y leer sola cuando vuelva la señal.
        </p>
      </div>
    );
  }

  if (receipt.status === 'pending_ocr') {
    return <p style={{ padding: 24, fontSize: 14, color: '#766F64' }}>Leyendo el ticket…</p>;
  }

  if (receipt.status === 'error') {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h1 style={{ fontSize: 24 }}>No se pudo leer el ticket</h1>
        <p style={{ fontSize: 14, color: '#766F64' }}>
          {receipt.error ?? 'Ocurrió un error al procesar la foto.'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '26px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 24 }}>Confirmá los productos</h1>

      {items.length === 0 && (
        <p style={{ fontSize: 14, color: '#766F64' }}>No se detectaron productos. Volvé a intentar con otra foto.</p>
      )}

      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            border: '1px solid #E3DED3',
            borderRadius: 10,
            padding: 10,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: 999, background: CONFIDENCE_COLOR[item.confidence], flexShrink: 0 }} />
          <input
            value={item.name}
            onChange={(e) => updateItem(i, { name: e.target.value })}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', color: '#2B2724' }}
          />
          <input
            type="number"
            step="any"
            value={item.quantity}
            onChange={(e) => updateItem(i, { quantity: Number(e.target.value) || 0 })}
            style={{ width: 56, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', color: '#2B2724' }}
          />
          <input
            value={item.unit}
            onChange={(e) => updateItem(i, { unit: e.target.value })}
            style={{ width: 50, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', color: '#2B2724' }}
          />
          <button onClick={() => removeItem(i)} aria-label="Quitar" style={{ background: 'transparent', border: 'none', color: '#A8412B', fontSize: 18 }}>
            ×
          </button>
        </div>
      ))}

      <button
        onClick={handleConfirm}
        disabled={saving || items.length === 0}
        style={{
          padding: 14,
          borderRadius: 10,
          background: '#2B2724',
          color: '#FAF8F4',
          fontWeight: 600,
          fontSize: 14.5,
          border: 'none',
          marginTop: 8,
        }}
      >
        {saving ? 'Guardando…' : 'Agregar a despensa'}
      </button>
    </div>
  );
}
