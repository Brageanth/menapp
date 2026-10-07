'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { captureReceipt } from '@/data/photo-queue';

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas no disponible');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('no se pudo comprimir la imagen'))),
      'image/jpeg',
      0.75
    );
  });
}

export default function CapturaPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      const id = await captureReceipt(compressed);
      router.push(`/despensa/captura/confirmar?id=${id}`);
    } catch {
      setError('No se pudo procesar la foto. Probá de nuevo.');
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: '26px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ fontSize: 28 }}>Agregar por foto</h1>
      <p style={{ fontSize: 14, color: '#766F64' }}>
        Sacale una foto al ticket de compra. La IA va a leer los productos por vos.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        disabled={busy}
        style={{ display: 'none' }}
      />

      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        style={{
          padding: 16,
          borderRadius: 10,
          background: '#2B2724',
          color: '#FAF8F4',
          fontWeight: 600,
          fontSize: 15,
          border: 'none',
          touchAction: 'manipulation',
        }}
      >
        {busy ? 'Procesando…' : 'Tomar foto'}
      </button>

      {error && <p style={{ fontSize: 13, color: '#A8412B' }}>{error}</p>}
    </div>
  );
}
