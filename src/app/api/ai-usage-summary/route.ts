import { createServerSupabaseClient } from '@/data/supabase-server';
import type { AiFeature, AiUsageLogRow } from '@/domain/ai-usage';

function fromRow(row: Record<string, unknown>): AiUsageLogRow {
  return {
    id: row.id as string,
    feature: row.feature as AiFeature,
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
    costUsd: Number(row.cost_usd),
    createdAt: row.created_at as string,
  };
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ai_usage_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json((data ?? []).map(fromRow));
}
