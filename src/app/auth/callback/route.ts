import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/data/supabase-server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('[auth/callback] exchangeCodeForSession failed', error.message);
      return NextResponse.redirect(`${origin}/login?error=link_expirado`);
    }
  }

  return NextResponse.redirect(`${origin}/hoy`);
}
