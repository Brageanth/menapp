'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { receiptRepo } from '@/data/repositories/receipt-repo';
import { inventoryRepo } from '@/data/repositories/inventory-repo';
import type { Receipt, ReceiptItem } from '@/domain/receipt';

const CONFIDENCE_COLOR: Record<ReceiptItem['confidence'], string> = {
  alta: '#3B7A3B',
  media: '#A8792B',
  baja: 'var(--accent)',
};

const CONFIDENCE_LABEL: Record<ReceiptItem['confidence'], string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
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
  const [quantityDrafts, setQuantityDrafts] = useState<string[]>([]);
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
      setQuantityDrafts(r.items.map((it) => String(it.quantity)));
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

  function updateQuantityDraft(index: number, raw: string) {
    setQuantityDrafts((prev) => prev.map((d, i) => (i === index ? raw : d)));
    updateItem(index, { quantity: raw.trim() === '' ? 0 : Number(raw) || 0 });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setQuantityDrafts((prev) => prev.filter((_, i) => i !== index));
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
        expiresAt: item.expiresAt || null,
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

  const needsHelp = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.confidence === 'baja');
  const confident = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.confidence !== 'baja');

  return (
    <div style={{ padding: '26px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 className="font-serif" style={{ fontSize: 24, fontWeight: 400 }}>
        Confirmá los productos
      </h1>

      {items.length === 0 && (
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>No se detectaron productos. Volvé a intentar con otra foto.</p>
      )}

      {needsHelp.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 className="font-serif" style={{ fontSize: 17, fontWeight: 400 }}>
              Necesito tu ayuda
            </h3>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
              {needsHelp.length} pendiente{needsHelp.length === 1 ? '' : 's'}
            </span>
          </div>
          {needsHelp.map(({ item, index }) => (
            <ReceiptItemCard
              key={index}
              item={item}
              quantityDraft={quantityDrafts[index] ?? ''}
              highlighted
              onUpdate={(patch) => updateItem(index, patch)}
              onUpdateQuantity={(raw) => updateQuantityDraft(index, raw)}
              onRemove={() => removeItem(index)}
            />
          ))}
        </section>
      )}

      {confident.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 className="font-serif" style={{ fontSize: 17, fontWeight: 400 }}>
            Leído con confianza
          </h3>
          {confident.map(({ item, index }) => (
            <ReceiptItemCard
              key={index}
              item={item}
              quantityDraft={quantityDrafts[index] ?? ''}
              onUpdate={(patch) => updateItem(index, patch)}
              onUpdateQuantity={(raw) => updateQuantityDraft(index, raw)}
              onRemove={() => removeItem(index)}
            />
          ))}
        </section>
      )}

      <button
        onClick={handleConfirm}
        disabled={saving || items.length === 0}
        style={{
          padding: 14,
          borderRadius: 10,
          background: 'var(--foreground)',
          color: 'var(--background)',
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

function ReceiptItemCard({
  item,
  quantityDraft,
  highlighted,
  onUpdate,
  onUpdateQuantity,
  onRemove,
}: {
  item: ReceiptItem;
  quantityDraft: string;
  highlighted?: boolean;
  onUpdate: (patch: Partial<ReceiptItem>) => void;
  onUpdateQuantity: (raw: string) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        border: highlighted ? 'none' : '1px solid var(--border)',
        background: highlighted ? 'var(--accent-soft)' : 'transparent',
        borderRadius: 10,
        padding: 10,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            color: CONFIDENCE_COLOR[item.confidence],
            border: `1px solid ${CONFIDENCE_COLOR[item.confidence]}`,
            borderRadius: 999,
            padding: '2px 7px',
            flexShrink: 0,
          }}
        >
          {CONFIDENCE_LABEL[item.confidence]}
        </span>
        <input
          value={item.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', color: 'var(--foreground)' }}
        />
        <input
          type="text"
          inputMode="decimal"
          value={quantityDraft}
          onChange={(e) => onUpdateQuantity(e.target.value)}
          style={{ width: 56, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', color: 'var(--foreground)' }}
        />
        <input
          value={item.unit}
          onChange={(e) => onUpdate({ unit: e.target.value })}
          style={{ width: 50, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', color: 'var(--foreground)' }}
        />
        <button onClick={onRemove} aria-label="Quitar" style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 18 }}>
          ×
        </button>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16, fontSize: 12, color: 'var(--muted)' }}>
        Vence
        <input
          type="date"
          value={item.expiresAt ?? ''}
          onChange={(e) => onUpdate({ expiresAt: e.target.value || null })}
          style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', fontSize: 13, background: 'transparent', color: 'var(--foreground)' }}
        />
      </label>
    </div>
  );
}
