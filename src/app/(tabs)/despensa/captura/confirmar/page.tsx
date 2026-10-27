'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { receiptRepo } from '@/data/repositories/receipt-repo';
import { inventoryRepo } from '@/data/repositories/inventory-repo';
import { shoppingListRepo } from '@/data/repositories/shopping-list-repo';
import { markPurchasedByNames } from '@/domain/shopping-list';
import { canonicalAmount, UNIT_CHOICES } from '@/domain/quantity';
import type { Receipt, ReceiptItem } from '@/domain/receipt';

/** El OCR a veces devuelve kg, L o "unidades"; en la pantalla todo parte de g, ml o unidad. */
function canonicalItem(item: ReceiptItem): ReceiptItem {
  const { quantity, unit } = canonicalAmount(item.quantity, item.unit);
  return { ...item, quantity, unit };
}

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
  /** Productos que la persona ya revisó y confirmó, en paralelo a `items`. */
  const [reviewed, setReviewed] = useState<boolean[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const receiptId = id;
    let ignore = false;

    async function poll() {
      const r = await receiptRepo.get(receiptId);
      if (ignore || !r) return;
      const canonical = r.items.map(canonicalItem);
      setReceipt(r);
      setItems(canonical);
      setQuantityDrafts(canonical.map((it) => String(it.quantity)));
      setReviewed(canonical.map(() => false));
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
    setReviewed((prev) => prev.filter((_, i) => i !== index));
  }

  function confirmItem(index: number) {
    setReviewed((prev) => prev.map((r, i) => (i === index ? true : r)));
  }

  async function handleConfirm() {
    if (!receipt) return;
    setSaving(true);
    const now = new Date().toISOString();
    // Secuencial: si el ticket trae el mismo producto dos veces, el segundo se suma al primero.
    for (const item of items) {
      await inventoryRepo.addOrMerge({
        id: crypto.randomUUID(),
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        ...(item.unitWeight ? { unitWeight: item.unitWeight } : {}),
        location: 'alacena',
        expiresAt: item.expiresAt || null,
        updatedAt: now,
      });
    }
    await receiptRepo.update({ ...receipt, items, status: 'confirmed' });

    const shoppingItems = await shoppingListRepo.list();
    const updated = markPurchasedByNames(shoppingItems, items.map((i) => i.name));
    const changed = updated.filter((u, i) => u !== shoppingItems[i]);
    await Promise.all(changed.map((i) => shoppingListRepo.update(i)));

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

  const indexed = items.map((item, index) => ({ item, index, isReviewed: reviewed[index] ?? false }));
  // Lo dudoso queda arriba hasta que se confirme o se descarte; lo demás ya se puede guardar tal cual.
  const needsHelp = indexed.filter(({ item, isReviewed }) => item.confidence === 'baja' && !isReviewed);
  const confident = indexed.filter(({ item, isReviewed }) => item.confidence !== 'baja' || isReviewed);

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
          {needsHelp.map(({ item, index, isReviewed }) => (
            <ReceiptItemCard
              key={index}
              item={item}
              quantityDraft={quantityDrafts[index] ?? ''}
              reviewed={isReviewed}
              onConfirm={() => confirmItem(index)}
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
          {confident.map(({ item, index, isReviewed }) => (
            <ReceiptItemCard
              key={index}
              item={item}
              quantityDraft={quantityDrafts[index] ?? ''}
              reviewed={isReviewed}
              onConfirm={() => confirmItem(index)}
              onUpdate={(patch) => updateItem(index, patch)}
              onUpdateQuantity={(raw) => updateQuantityDraft(index, raw)}
              onRemove={() => removeItem(index)}
            />
          ))}
        </section>
      )}

      <button
        onClick={handleConfirm}
        disabled={saving || items.length === 0 || needsHelp.length > 0}
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
        {saving ? 'Guardando…' : `Agregar ${items.length} a despensa`}
      </button>
      {needsHelp.length > 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', marginTop: -8 }}>
          Confirmá o descartá los {needsHelp.length} pendiente{needsHelp.length === 1 ? '' : 's'} para seguir.
        </p>
      )}
    </div>
  );
}

function ReceiptItemCard({
  item,
  quantityDraft,
  highlighted,
  reviewed,
  onUpdate,
  onUpdateQuantity,
  onConfirm,
  onRemove,
}: {
  item: ReceiptItem;
  quantityDraft: string;
  highlighted?: boolean;
  reviewed: boolean;
  onUpdate: (patch: Partial<ReceiptItem>) => void;
  onUpdateQuantity: (raw: string) => void;
  onConfirm: () => void;
  onRemove: () => void;
}) {
  const unitKnown = UNIT_CHOICES.some((c) => c.id === item.unit);
  const field: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 14,
    background: 'transparent',
    color: 'var(--foreground)',
    minWidth: 0,
  };
  const action: React.CSSProperties = {
    flex: 1,
    padding: '9px 0',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    touchAction: 'manipulation',
  };

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
          aria-label="Nombre del producto"
          style={{ ...field, flex: 1 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          inputMode="decimal"
          value={quantityDraft}
          onChange={(e) => onUpdateQuantity(e.target.value)}
          aria-label="Cantidad"
          style={{ ...field, width: 80 }}
        />
        <select
          value={item.unit}
          onChange={(e) => onUpdate({ unit: e.target.value })}
          aria-label="Unidad"
          style={{ ...field, flex: 1 }}
        >
          {UNIT_CHOICES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
          {!unitKnown && <option value={item.unit}>{item.unit}</option>}
        </select>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
        Vence
        <input
          type="date"
          value={item.expiresAt ?? ''}
          onChange={(e) => onUpdate({ expiresAt: e.target.value || null })}
          style={{ ...field, padding: '4px 6px', fontSize: 13 }}
        />
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onRemove}
          style={{ ...action, background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)' }}
        >
          Descartar
        </button>
        {reviewed ? (
          <span style={{ ...action, textAlign: 'center', color: CONFIDENCE_COLOR.alta, border: '1px solid transparent' }}>
            ✓ Confirmado
          </span>
        ) : (
          <button
            onClick={onConfirm}
            style={{ ...action, background: 'var(--foreground)', color: 'var(--background)', border: '1px solid var(--foreground)' }}
          >
            Confirmar
          </button>
        )}
      </div>
    </div>
  );
}
