'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signInWithMagicLink } from '@/lib/auth';

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'link_expirado'
      ? 'El link ya se usó o venció. Pedí uno nuevo.'
      : null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);
    const { error } = await signInWithMagicLink(email);
    setSending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 24px',
        background: '#FAF8F4',
      }}
    >
      <h1 style={{ fontSize: 38, marginBottom: 8 }}>Menapp</h1>
      <p style={{ fontSize: 14, color: '#766F64', marginBottom: 24 }}>
        Un solo login por hogar. Te mandamos un link de acceso.
      </p>
      {sent ? (
        <p style={{ fontSize: 14 }}>Revisá tu correo y tocá el link para entrar.</p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            required
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid #2B2724',
              fontSize: 15,
              background: 'transparent',
            }}
          />
          <button
            type="submit"
            disabled={sending}
            style={{
              padding: 14,
              borderRadius: 10,
              background: sending ? '#CFC8BA' : '#2B2724',
              color: '#FAF8F4',
              fontWeight: 600,
              fontSize: 14.5,
              border: 'none',
            }}
          >
            {sending ? 'Enviando…' : 'Enviar link de acceso'}
          </button>
          {error && <p style={{ fontSize: 13, color: '#A8412B' }}>{error}</p>}
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
