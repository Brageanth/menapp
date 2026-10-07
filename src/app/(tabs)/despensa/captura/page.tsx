'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

const CORNER_BASE: React.CSSProperties = {
  position: 'absolute',
  width: 28,
  height: 28,
  borderColor: 'var(--foreground)',
};

export default function CapturaPage() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
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
    <div style={{ padding: '26px 24px', display: 'flex', flexDirection: 'column', gap: 26, minHeight: '100%' }}>
      <div>
        <h1 className="font-serif" style={{ fontSize: 28, fontWeight: 400 }}>
          Agregar por foto
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
          La IA lee productos, cantidades y vencimientos.
        </p>
      </div>

      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 220,
          background: 'var(--background)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: 20,
        }}
      >
        <span style={{ ...CORNER_BASE, top: 0, left: 0, borderTop: '3px solid', borderLeft: '3px solid', borderRadius: '6px 0 0 0' }} />
        <span style={{ ...CORNER_BASE, top: 0, right: 0, borderTop: '3px solid', borderRight: '3px solid', borderRadius: '0 6px 0 0' }} />
        <span style={{ ...CORNER_BASE, bottom: 0, left: 0, borderBottom: '3px solid', borderLeft: '3px solid', borderRadius: '0 0 0 6px' }} />
        <span style={{ ...CORNER_BASE, bottom: 0, right: 0, borderBottom: '3px solid', borderRight: '3px solid', borderRadius: '0 0 6px 0' }} />
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="14" y2="17" />
        </svg>
        <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', maxWidth: 190, lineHeight: 1.4 }}>
          Encuadrá la factura completa, con buena luz y sin sombras.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          disabled={busy}
          style={{ display: 'none' }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={busy}
          style={{ display: 'none' }}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={busy}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
              padding: 14,
              borderRadius: 10,
              background: 'var(--foreground)',
              color: 'var(--background)',
              fontWeight: 600,
              fontSize: 14.5,
              border: '1px solid var(--foreground)',
              touchAction: 'manipulation',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--background)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            {busy ? 'Procesando…' : 'Tomar foto'}
          </button>
          <button
            onClick={() => galleryInputRef.current?.click()}
            disabled={busy}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
              padding: 14,
              borderRadius: 10,
              background: 'transparent',
              color: 'var(--foreground)',
              fontWeight: 600,
              fontSize: 14.5,
              border: '1px solid var(--foreground)',
              touchAction: 'manipulation',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            Galería
          </button>
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.45 }}>
          Si algo no queda claro, te pregunto antes de guardar.
        </p>

        <Link
          href="/despensa"
          style={{
            textAlign: 'center',
            fontSize: 13.5,
            fontWeight: 600,
            textDecoration: 'underline',
            textUnderlineOffset: 4,
            alignSelf: 'center',
            padding: '13px 0',
            color: 'var(--foreground)',
          }}
        >
          Agregar un producto a mano
        </Link>

        {error && <p style={{ fontSize: 13, color: 'var(--accent)', textAlign: 'center' }}>{error}</p>}
      </div>
    </div>
  );
}
