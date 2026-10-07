import { createServerSupabaseClient } from '@/data/supabase-server';

export async function POST(req: Request) {
  const { endpoint, p256dh, auth } = (await req.json()) as {
    endpoint?: string;
    p256dh?: string;
    auth?: string;
  };

  if (!endpoint || !p256dh || !auth) {
    return Response.json({ error: 'faltan datos de suscripción' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('push_subscriptions').upsert({ endpoint, p256dh, auth });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
