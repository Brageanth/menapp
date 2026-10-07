'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { AiFeature, AiUsageLogRow } from '@/domain/ai-usage';
import { AI_FEATURE_LABELS, summarizeAiUsage } from '@/domain/ai-usage';

function formatUsd(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

export default function CostosIaPage() {
  const [rows, setRows] = useState<AiUsageLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<'mes' | 'todo'>('mes');

  useEffect(() => {
    fetch('/api/ai-usage-summary')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setRows(data);
        else setError(data.error ?? 'no se pudo cargar');
      })
      .catch((err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (range === 'todo') return rows;
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return rows.filter((r) => r.createdAt.slice(0, 7) === monthKey);
  }, [rows, range]);

  const summary = useMemo(() => summarizeAiUsage(filtered), [filtered]);

  return (
    <div style={{ padding: '26px 24px 100px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Link href="/avisos" style={{ fontSize: 13, color: '#766F64' }}>
          ← Avisos
        </Link>
        <h1 style={{ fontSize: 32, marginTop: 6 }}>Costos IA</h1>
        <p style={{ fontSize: 13, color: '#766F64', marginTop: 8 }}>
          Lo que cuestan las 3 features con Claude Haiku (OCR, generar menú, ajustar receta). Free tier de Vercel/Supabase no cubre esto — es gasto real de la API de Anthropic.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => setRange('mes')}
          style={{ flex: 1, padding: '8px 0', borderRadius: 999, border: `1px solid ${range === 'mes' ? '#2B2724' : '#E3DED3'}`, background: range === 'mes' ? '#2B2724' : 'transparent', color: range === 'mes' ? '#FAF8F4' : '#766F64', fontSize: 13, fontWeight: 600 }}
        >
          Este mes
        </button>
        <button
          onClick={() => setRange('todo')}
          style={{ flex: 1, padding: '8px 0', borderRadius: 999, border: `1px solid ${range === 'todo' ? '#2B2724' : '#E3DED3'}`, background: range === 'todo' ? '#2B2724' : 'transparent', color: range === 'todo' ? '#FAF8F4' : '#766F64', fontSize: 13, fontWeight: 600 }}
        >
          Todo
        </button>
      </div>

      {error && <p style={{ fontSize: 13, color: '#A8412B' }}>No se pudo cargar: {error}</p>}

      {!error && rows === null && <p style={{ fontSize: 13, color: '#766F64' }}>Cargando…</p>}

      {!error && rows !== null && (
        <>
          <div style={{ padding: 18, borderRadius: 10, border: '1px solid #2B2724', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#766F64' }}>{summary.totalCalls} llamada{summary.totalCalls === 1 ? '' : 's'}</div>
            <div style={{ fontSize: 32, fontWeight: 600, marginTop: 4 }}>{formatUsd(summary.totalCostUsd)}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(Object.keys(AI_FEATURE_LABELS) as AiFeature[]).map((feature) => {
              const b = summary.byFeature[feature];
              if (b.calls === 0) return null;
              return (
                <div key={feature} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #E3DED3' }}>
                  <div>
                    <div style={{ fontSize: 14 }}>{AI_FEATURE_LABELS[feature]}</div>
                    <div style={{ fontSize: 12, color: '#766F64' }}>{b.calls} llamada{b.calls === 1 ? '' : 's'} · {b.inputTokens + b.outputTokens} tokens</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{formatUsd(b.costUsd)}</div>
                </div>
              );
            })}
            {summary.totalCalls === 0 && (
              <p style={{ fontSize: 13, color: '#766F64' }}>Sin llamadas a IA en este período.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
