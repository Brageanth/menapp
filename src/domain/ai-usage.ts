export type AiFeature = 'ocr' | 'generate-menu' | 'adjust-recipe';

export const AI_FEATURE_LABELS: Record<AiFeature, string> = {
  ocr: 'Captura de factura (OCR)',
  'generate-menu': 'Generar menú',
  'adjust-recipe': 'Ajustar receta',
};

/** Precio de Claude Haiku 4.5 por millón de tokens, USD. Único modelo que usan las 3 features (ver Stack en AUDITORIA_Y_PLAN.md). */
const HAIKU_PRICE_PER_1M_USD = { input: 1.0, output: 5.0 };

export function calcCostUsd(inputTokens: number, outputTokens: number): number {
  const cost = (inputTokens / 1_000_000) * HAIKU_PRICE_PER_1M_USD.input + (outputTokens / 1_000_000) * HAIKU_PRICE_PER_1M_USD.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export interface AiUsageLogRow {
  id: string;
  feature: AiFeature;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  createdAt: string;
}

export interface AiUsageSummary {
  totalCostUsd: number;
  totalCalls: number;
  byFeature: Record<AiFeature, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }>;
}

export function summarizeAiUsage(rows: AiUsageLogRow[]): AiUsageSummary {
  const byFeature: AiUsageSummary['byFeature'] = {
    ocr: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
    'generate-menu': { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
    'adjust-recipe': { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
  };
  for (const row of rows) {
    const bucket = byFeature[row.feature];
    bucket.calls += 1;
    bucket.inputTokens += row.inputTokens;
    bucket.outputTokens += row.outputTokens;
    bucket.costUsd += row.costUsd;
  }
  return {
    totalCostUsd: rows.reduce((sum, r) => sum + r.costUsd, 0),
    totalCalls: rows.length,
    byFeature,
  };
}
