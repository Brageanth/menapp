import { createServerSupabaseClient } from './supabase-server';
import { calcCostUsd, type AiFeature } from '@/domain/ai-usage';

/**
 * Logs one Claude Haiku call to `ai_usage_log` for cost telemetry (F11). Append-only, server-only —
 * no Dexie table, no offline queue, it just doesn't matter if a log row is lost on a network blip,
 * unlike every other write in the app. Never let a logging failure break the actual feature: call
 * this after `return`-ing the real response isn't possible (route already returned), so callers
 * await it but this function itself swallows its own errors.
 */
export async function logAiUsage(
  feature: AiFeature,
  usage: { inputTokens: number | undefined; outputTokens: number | undefined }
): Promise<void> {
  try {
    const inputTokens = usage.inputTokens ?? 0;
    const outputTokens = usage.outputTokens ?? 0;
    const supabase = await createServerSupabaseClient();
    await supabase.from('ai_usage_log').insert({
      feature,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: calcCostUsd(inputTokens, outputTokens),
    });
  } catch (err) {
    console.error('[ai-usage] log failed', feature, err);
  }
}
