import { createServerSupabaseClient } from './supabase-server';

/** Tope de gasto en IA por día (USD). Corta las rutas /api de Claude si se supera, aunque haya sesión válida. */
const DAILY_COST_CAP_USD = 1;
/** Tope de tamaño del body de una request a una ruta de IA (bytes). */
const MAX_BODY_BYTES = 20_000;

/**
 * Guard común de las rutas de IA: exige sesión, limita el tamaño del body y corta si el gasto
 * de las últimas 24h en `ai_usage_log` supera DAILY_COST_CAP_USD. Devuelve una Response de error
 * si hay que cortar, o null si la request puede seguir. Si falla la lectura del log, cierra
 * (fail-closed): mejor bloquear una llamada que dejar la puerta abierta.
 */
export async function guardAi(req: Request): Promise<Response | null> {
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: 'request demasiado grande' }, { status: 413 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: 'no autorizado' }, { status: 401 });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from('ai_usage_log').select('cost_usd').gte('created_at', since).limit(5000);
  if (error) return Response.json({ error: 'no se pudo verificar el tope de gasto' }, { status: 503 });

  const spent = (data ?? []).reduce((sum, row) => sum + Number(row.cost_usd), 0);
  if (spent >= DAILY_COST_CAP_USD) {
    return Response.json({ error: 'tope diario de IA alcanzado' }, { status: 429 });
  }

  return null;
}
