'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/data/supabase-client';

type EmailOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email';
const VALID_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/hoy';
  const valid = !!tokenHash && !!type && VALID_TYPES.includes(type as EmailOtpType);

  async function handleConfirm() {
    if (!valid || state === 'loading') return;
    setState('loading');
    const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash! });
    if (error) {
      setState('error');
      return;
    }
    router.replace(next);
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 24px',
        background: '#FAF8F4',
        textAlign: 'center',
        gap: 16,
      }}
    >
      <h1 style={{ fontSize: 32 }}>Menapp</h1>
      {!valid || state === 'error' ? (
        <>
          <p style={{ fontSize: 14, color: '#A8412B' }}>El link ya se usó o venció. Pedí uno nuevo.</p>
          <button
            onClick={() => router.replace('/login')}
            style={{
              padding: '12px 20px',
              borderRadius: 10,
              background: '#2B2724',
              color: '#FAF8F4',
              fontWeight: 600,
              fontSize: 14.5,
              border: 'none',
            }}
          >
            Volver a Login
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 14, color: '#766F64' }}>Tocá para completar el acceso.</p>
          <button
            onClick={handleConfirm}
            disabled={state === 'loading'}
            style={{
              padding: '14px 24px',
              borderRadius: 10,
              background: state === 'loading' ? '#CFC8BA' : '#2B2724',
              color: '#FAF8F4',
              fontWeight: 600,
              fontSize: 14.5,
              border: 'none',
            }}
          >
            {state === 'loading' ? 'Entrando…' : 'Entrar a Menapp'}
          </button>
        </>
      )}
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmContent />
    </Suspense>
  );
}
