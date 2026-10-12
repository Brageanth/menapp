'use client';

import { useEffect, useMemo, useState } from 'react';
import { componentRepo } from '@/data/repositories/component-repo';
import { componentBatchRepo } from '@/data/repositories/component-batch-repo';
import type { Component } from '@/domain/component';
import {
  buildPreparationPlan,
  componentsNeedingBatch,
  consumePortions,
  createBatch,
  freezeBatch,
  isExpired,
  markExpired,
  unfreezeBatch,
  type ComponentBatch,
} from '@/domain/component-batch';

const EFFORT_LABELS: Record<'bajo' | 'medio' | 'alto' | 'sin-definir', string> = {
  bajo: 'Esfuerzo bajo',
  medio: 'Esfuerzo medio',
  alto: 'Esfuerzo alto',
  'sin-definir': 'Sin esfuerzo definido',
};

export default function LotesPage() {
  const [components, setComponents] = useState<Component[]>([]);
  const [batches, setBatches] = useState<ComponentBatch[]>([]);
  const [now, setNow] = useState<Date | null>(null);
  const [registering, setRegistering] = useState<Component | null>(null);
  const [portions, setPortions] = useState('4');
  const [location, setLocation] = useState('nevera');

  useEffect(() => {
    let ignore = false;
    Promise.all([componentRepo.list(), componentBatchRepo.list()]).then(([c, b]) => {
      if (ignore) return;
      setComponents(c);
      setBatches(b);
      setNow(new Date());
    });
    return () => {
      ignore = true;
    };
  }, []);

  async function refresh() {
    const [c, b] = await Promise.all([componentRepo.list(), componentBatchRepo.list()]);
    setComponents(c);
    setBatches(b);
  }

  const componentMap = useMemo(() => new Map(components.map((c) => [c.id, c])), [components]);

  const pending = useMemo(() => (now ? componentsNeedingBatch(components, batches, now) : []), [components, batches, now]);
  const plan = useMemo(() => buildPreparationPlan(pending), [pending]);

  const activeBatches = useMemo(
    () => batches.filter((b) => (b.status === 'available' || b.status === 'frozen') && b.remainingPortions > 0),
    [batches]
  );
  const available = activeBatches.filter((b) => b.status === 'available');
  const frozen = activeBatches.filter((b) => b.status === 'frozen');

  async function handleRegister() {
    if (!registering) return;
    const batch = createBatch(crypto.randomUUID(), registering, new Date().toISOString(), Number(portions) || 1, location);
    await componentBatchRepo.add(batch);
    setRegistering(null);
    setPortions('4');
    refresh();
  }

  async function handleConsume(batch: ComponentBatch) {
    await componentBatchRepo.update(consumePortions(batch, 1));
    refresh();
  }

  async function handleFreeze(batch: ComponentBatch) {
    await componentBatchRepo.update(freezeBatch(batch));
    refresh();
  }

  async function handleUnfreeze(batch: ComponentBatch) {
    await componentBatchRepo.update(unfreezeBatch(batch));
    refresh();
  }

  async function handleDiscard(batch: ComponentBatch) {
    await componentBatchRepo.update(markExpired(batch));
    refresh();
  }

  const effortOrder: ('bajo' | 'medio' | 'alto' | 'sin-definir')[] = ['alto', 'medio', 'bajo', 'sin-definir'];

  return (
    <div style={{ padding: '26px 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ fontSize: 32 }}>Lotes</h1>

      {pending.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ fontSize: 16, color: '#2B2724' }}>Plan de preparación</h2>
          {plan.tooMuchEffort && (
            <p style={{ fontSize: 12.5, color: '#A8412B' }}>
              Son {pending.length} componentes sin lote — considerá dividirlo en más de un día.
            </p>
          )}
          {effortOrder.map(
            (effort) =>
              plan.byEffort[effort].length > 0 && (
                <div key={effort} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#766F64' }}>{EFFORT_LABELS[effort]}</span>
                  {plan.byEffort[effort].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setRegistering(c)}
                      style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #E3DED3', background: 'transparent', textAlign: 'left' }}
                    >
                      <span style={{ fontSize: 14.5, color: '#2B2724' }}>{c.name}</span>
                      <span style={{ fontSize: 12.5, color: '#A8412B' }}>Registrar lote →</span>
                    </button>
                  ))}
                </div>
              )
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ fontSize: 16, color: '#2B2724' }}>Disponibles</h2>
        {available.length === 0 && <p style={{ fontSize: 13, color: '#766F64' }}>Nada preparado todavía.</p>}
        {available.map((b) => (
          <BatchRow key={b.id} batch={b} component={componentMap.get(b.componentId)} now={now} onConsume={() => handleConsume(b)} onFreeze={() => handleFreeze(b)} onDiscard={() => handleDiscard(b)} />
        ))}
      </div>

      {frozen.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ fontSize: 16, color: '#2B2724' }}>Congelados</h2>
          {frozen.map((b) => (
            <BatchRow key={b.id} batch={b} component={componentMap.get(b.componentId)} now={now} onConsume={() => handleConsume(b)} onUnfreeze={() => handleUnfreeze(b)} onDiscard={() => handleDiscard(b)} />
          ))}
        </div>
      )}

      {registering && (
        <div style={{ position: 'fixed', inset: 0, height: '100dvh', background: 'rgba(43,39,36,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }} onClick={() => setRegistering(null)}>
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', background: '#FAF8F4', borderRadius: '16px 16px 0 0', padding: '24px 24px calc(24px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <h2 style={{ fontSize: 22 }}>Registrar lote de {registering.name}</h2>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64', flex: 1 }}>
                Porciones
                <input type="number" value={portions} onChange={(e) => setPortions(e.target.value)} style={inputStyle} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64', flex: 1 }}>
                Ubicación
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="nevera, freezer…" style={inputStyle} />
              </label>
            </div>
            {registering.cookedShelfLifeDays && <p style={{ fontSize: 12.5, color: '#766F64' }}>Vence en {registering.cookedShelfLifeDays} días desde hoy.</p>}
            <button onClick={handleRegister} style={{ padding: 14, borderRadius: 10, background: '#2B2724', color: '#FAF8F4', fontWeight: 600, fontSize: 14.5, border: 'none' }}>
              Guardar lote
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BatchRow({
  batch,
  component,
  now,
  onConsume,
  onFreeze,
  onUnfreeze,
  onDiscard,
}: {
  batch: ComponentBatch;
  component: Component | undefined;
  now: Date | null;
  onConsume: () => void;
  onFreeze?: () => void;
  onUnfreeze?: () => void;
  onDiscard: () => void;
}) {
  const expiringSoon = now && isExpired({ ...batch, expiresAt: batch.expiresAt }, new Date(now.getTime() + 24 * 60 * 60 * 1000));
  return (
    <div style={{ border: '1px solid #E3DED3', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#2B2724' }}>{component?.name ?? batch.componentId}</span>
        <span style={{ fontSize: 13, color: '#766F64' }}>{batch.remainingPortions} porciones</span>
      </div>
      <div style={{ fontSize: 12, color: expiringSoon ? '#A8412B' : '#766F64' }}>
        {batch.location} · {batch.expiresAt ? `vence ${new Date(batch.expiresAt).toLocaleDateString('es')}` : 'sin vencimiento estimado'}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onConsume} style={smallButtonStyle}>
          Usar 1 porción
        </button>
        {onFreeze && (
          <button onClick={onFreeze} style={smallButtonStyle}>
            Congelar
          </button>
        )}
        {onUnfreeze && (
          <button onClick={onUnfreeze} style={smallButtonStyle}>
            Descongelar
          </button>
        )}
        <button onClick={onDiscard} style={{ ...smallButtonStyle, color: '#A8412B', borderColor: '#A8412B' }}>
          Retirar
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { padding: '12px 14px', borderRadius: 8, border: '1px solid #2B2724', fontSize: 15, background: 'transparent', color: '#2B2724', fontFamily: 'inherit' };
const smallButtonStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 999, border: '1px solid #E3DED3', background: 'transparent', color: '#2B2724', fontSize: 12, fontWeight: 600 };
