import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // El login es magic link verificado por token_hash (ver src/app/auth/confirm),
    // no code-exchange — con flowType 'pkce' (el default) Supabase emite un
    // token_hash con prefijo pkce_ que verifyOtp rechaza siempre.
    { auth: { flowType: 'implicit' } }
  );
}

export const supabase = createClient();
