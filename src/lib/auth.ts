import { supabase } from '@/data/supabase-client';

export async function signInWithMagicLink(email: string) {
  return supabase.auth.signInWithOtp({ email });
}

export async function signOut() {
  return supabase.auth.signOut();
}
