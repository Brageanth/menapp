import { createServerSupabaseClient } from '@/data/supabase-server';

export async function POST(req: Request) {
  const { endpoint } = (await req.json()) as { endpoint?: string };
  if (!endpoint) return Response.json({ error: 'falta endpoint' }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
