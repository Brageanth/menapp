'use client';

import { useState } from 'react';
import type { Component, ComponentOrigin, MacrosBasis, NewComponentInput, RoleId, WeightState } from '@/domain/component';
import { SEED_ROLES, validateNewComponent } from '@/domain/component';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';

export function ComponentFormSheet({
  initial,
  onSave,
  onArchive,
  onClose,
}: {
  initial?: Component;
  onSave: (values: NewComponentInput) => void;
  onArchive?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [roles, setRoles] = useState<RoleId[]>(initial?.roles ?? []);
  const [origin, setOrigin] = useState<ComponentOrigin>(initial?.origin ?? 'simple');
  const [unit, setUnit] = useState(initial?.unit ?? 'g');
  const [weightState, setWeightState] = useState<WeightState>(initial?.weightState ?? 'crudo');
  const [typical, setTypical] = useState(String(initial?.portion.typical ?? 100));
  const [min, setMin] = useState(String(initial?.portion.min ?? 50));
  const [max, setMax] = useState(String(initial?.portion.max ?? 300));
  const [step, setStep] = useState(String(initial?.portion.step ?? 10));
  const [macrosBasis, setMacrosBasis] = useState<MacrosBasis>(initial?.macrosBasis ?? 'per100g');
  const [kcal, setKcal] = useState(String(initial?.macros.kcal ?? ''));
  const [protein, setProtein] = useState(String(initial?.macros.protein ?? ''));
  const [carbs, setCarbs] = useState(String(initial?.macros.carbs ?? ''));
  const [fat, setFat] = useState(String(initial?.macros.fat ?? ''));
  const [isTreat, setIsTreat] = useState(initial?.isTreat ?? false);
  const [favorite, setFavorite] = useState(initial?.favorite ?? false);
  const [ingredientsText, setIngredientsText] = useState(
    initial?.ingredients?.map((i) => `${i.quantity} ${i.unit} ${i.name}`).join('\n') ?? ''
  );
  const [stepsText, setStepsText] = useState(initial?.steps?.join('\n') ?? '');
  const [showMore, setShowMore] = useState(false);
  const [batchable, setBatchable] = useState(initial?.batchable ?? false);
  const [cookedShelfLifeDays, setCookedShelfLifeDays] = useState(String(initial?.cookedShelfLifeDays ?? ''));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useLockBodyScroll(onClose);

  async function handleAiAdjust() {
    if (!aiInstruction.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setAiSummary(null);
    try {
      const res = await fetch('/api/adjust-component', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          component: {
            name,
            roles,
            unit,
            macrosBasis,
            macros: { kcal: Number(kcal) || 0, protein: Number(protein) || 0, carbs: Number(carbs) || 0, fat: Number(fat) || 0 },
            portion: { typical: Number(typical), min: Number(min), max: Number(max), step: Number(step) },
            isTreat,
          },
          instruction: aiInstruction,
        }),
      });
      if (!res.ok) throw new Error('No se pudo procesar el pedido.');
      const diff = await res.json();
      if (diff.nameChange) setName(diff.nameChange);
      if (diff.macrosChange) {
        setKcal(String(diff.macrosChange.kcal));
        setProtein(String(diff.macrosChange.protein));
        setCarbs(String(diff.macrosChange.carbs));
        setFat(String(diff.macrosChange.fat));
      }
      if (diff.portionChange) {
        setTypical(String(diff.portionChange.typical));
        setMin(String(diff.portionChange.min));
        setMax(String(diff.portionChange.max));
        setStep(String(diff.portionChange.step));
      }
      if (diff.isTreatChange !== null) setIsTreat(diff.isTreatChange);
      setAiSummary(diff.summary);
      setAiInstruction('');
    } catch {
      setAiError('No se pudo procesar el pedido. Probá de nuevo.');
    } finally {
      setAiLoading(false);
    }
  }

  function toggleRole(role: RoleId) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  function parseIngredients() {
    return ingredientsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^([\d.]+)\s*([a-zA-Zñ%]*)\s+(.+)$/);
        if (match) return { quantity: Number(match[1]), unit: match[2] || unit, name: match[3] };
        return { quantity: 1, unit, name: line };
      });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: NewComponentInput = {
      name: name.trim(),
      roles,
      origin,
      unit: unit.trim(),
      portion: { typical: Number(typical), min: Number(min), max: Number(max), step: Number(step) },
      weightState,
      macrosBasis,
      macros: { kcal: Number(kcal) || 0, protein: Number(protein) || 0, carbs: Number(carbs) || 0, fat: Number(fat) || 0 },
      isTreat,
      favorite,
      batchable: origin === 'preparado' ? batchable : undefined,
      cookedShelfLifeDays: cookedShelfLifeDays ? Number(cookedShelfLifeDays) : undefined,
      notes: notes.trim() || undefined,
      ingredients: origin === 'preparado' ? parseIngredients() : undefined,
      steps: origin === 'preparado' ? stepsText.split('\n').map((s) => s.trim()).filter(Boolean) : undefined,
    };
    const validationErrors = validateNewComponent(input);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSave(input);
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, height: '100dvh', background: 'rgba(43,39,36,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          background: '#FAF8F4',
          borderRadius: '16px 16px 0 0',
          padding: '24px 24px calc(24px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          maxHeight: '88dvh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ fontSize: 24 }}>{initial ? 'Editar componente' : 'Nuevo componente'}</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              placeholder={initial ? 'Pedí un cambio: "bajale las kcal a 120"' : 'Describí qué querés ajustar antes de guardar'}
              style={{ ...inputStyle, fontSize: 13.5 }}
            />
            <button
              type="button"
              onClick={handleAiAdjust}
              disabled={aiLoading || !aiInstruction.trim()}
              style={{ padding: '0 16px', borderRadius: 8, border: 'none', background: '#2B2724', color: '#FAF8F4', fontWeight: 600, fontSize: 13, opacity: aiLoading ? 0.6 : 1 }}
            >
              {aiLoading ? '...' : 'Pedir'}
            </button>
          </div>
          {aiSummary && <p style={{ fontSize: 12.5, color: '#3F7D4F' }}>{aiSummary} — revisá los campos abajo antes de guardar.</p>}
          {aiError && <p style={{ fontSize: 12.5, color: '#A8412B' }}>{aiError}</p>}
        </div>

        {errors.length > 0 && (
          <div style={{ fontSize: 13, color: '#A8412B', background: 'rgba(168,65,43,0.08)', borderRadius: 8, padding: '10px 12px' }}>
            {errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        )}

        <label style={labelStyle}>
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus style={inputStyle} />
        </label>

        <div style={labelStyle}>
          Roles
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SEED_ROLES.map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => toggleRole(r.id)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  border: roles.includes(r.id) ? '1px solid #2B2724' : '1px solid #E3DED3',
                  background: roles.includes(r.id) ? '#2B2724' : 'transparent',
                  color: roles.includes(r.id) ? '#FAF8F4' : '#2B2724',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <label style={labelStyle}>
          Tipo
          <div style={{ display: 'flex', gap: 8 }}>
            {(['simple', 'preparado'] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOrigin(o)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  border: origin === o ? '1px solid #2B2724' : '1px solid #E3DED3',
                  background: origin === o ? '#2B2724' : 'transparent',
                  color: origin === o ? '#FAF8F4' : '#2B2724',
                  fontSize: 14,
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }}
              >
                {o}
              </button>
            ))}
          </div>
        </label>

        {origin === 'preparado' && (
          <>
            <label style={labelStyle}>
              Ingredientes (uno por línea: cantidad unidad nombre)
              <textarea value={ingredientsText} onChange={(e) => setIngredientsText(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </label>
            <label style={labelStyle}>
              Pasos (uno por línea)
              <textarea value={stepsText} onChange={(e) => setStepsText(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </label>
          </>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ ...labelStyle, flex: 1 }}>
            Unidad
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="g, ml, unidad" style={inputStyle} />
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>
            Estado del peso
            <div style={{ display: 'flex', gap: 8 }}>
              {(['crudo', 'cocido'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeightState(w)}
                  style={{
                    flex: 1,
                    padding: 11,
                    borderRadius: 8,
                    border: weightState === w ? '1px solid #2B2724' : '1px solid #E3DED3',
                    background: weightState === w ? '#2B2724' : 'transparent',
                    color: weightState === w ? '#FAF8F4' : '#2B2724',
                    fontSize: 13,
                    fontWeight: 600,
                    textTransform: 'capitalize',
                  }}
                >
                  {w}
                </button>
              ))}
            </div>
          </label>
        </div>

        <div style={labelStyle}>
          Porción (en {unit || 'unidad'})
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={typical} onChange={(e) => setTypical(e.target.value)} type="number" placeholder="típica" style={inputStyle} />
            <input value={min} onChange={(e) => setMin(e.target.value)} type="number" placeholder="mín" style={inputStyle} />
            <input value={max} onChange={(e) => setMax(e.target.value)} type="number" placeholder="máx" style={inputStyle} />
            <input value={step} onChange={(e) => setStep(e.target.value)} type="number" placeholder="paso" style={inputStyle} />
          </div>
        </div>

        <label style={labelStyle}>
          Macros por {macrosBasis === 'per100g' ? `100${unit || 'g'}` : unit || 'unidad'}
          <button
            type="button"
            onClick={() => setMacrosBasis(macrosBasis === 'per100g' ? 'perUnit' : 'per100g')}
            style={{ alignSelf: 'flex-start', fontSize: 12, color: '#A8412B', background: 'none', border: 'none', padding: 0 }}
          >
            cambiar a {macrosBasis === 'per100g' ? `por ${unit || 'unidad'}` : 'por 100'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={kcal} onChange={(e) => setKcal(e.target.value)} type="number" placeholder="kcal" style={inputStyle} />
            <input value={protein} onChange={(e) => setProtein(e.target.value)} type="number" placeholder="prot" style={inputStyle} />
            <input value={carbs} onChange={(e) => setCarbs(e.target.value)} type="number" placeholder="carb" style={inputStyle} />
            <input value={fat} onChange={(e) => setFat(e.target.value)} type="number" placeholder="grasa" style={inputStyle} />
          </div>
        </label>

        <div style={{ display: 'flex', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#2B2724' }}>
            <input type="checkbox" checked={isTreat} onChange={(e) => setIsTreat(e.target.checked)} /> Es un gusto
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#2B2724' }}>
            <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} /> Favorito
          </label>
        </div>

        <button type="button" onClick={() => setShowMore((v) => !v)} style={{ alignSelf: 'flex-start', fontSize: 13, color: '#766F64', background: 'none', border: 'none', padding: 0 }}>
          {showMore ? 'Ocultar detalles' : 'Más detalles'}
        </button>

        {showMore && (
          <>
            {origin === 'preparado' && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#2B2724' }}>
                  <input type="checkbox" checked={batchable} onChange={(e) => setBatchable(e.target.checked)} /> Apto para preparar en lote
                </label>
                <label style={labelStyle}>
                  Vida útil cocinado (días)
                  <input value={cookedShelfLifeDays} onChange={(e) => setCookedShelfLifeDays(e.target.value)} type="number" style={inputStyle} />
                </label>
              </>
            )}
            <label style={labelStyle}>
              Notas
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </label>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          {initial && onArchive && initial.status === 'active' && (
            <button type="button" onClick={onArchive} style={{ padding: 14, borderRadius: 10, background: 'transparent', color: '#A8412B', fontWeight: 600, fontSize: 14.5, border: '1px solid #A8412B' }}>
              Archivar
            </button>
          )}
          <button type="submit" style={{ flex: 1, padding: 14, borderRadius: 10, background: '#2B2724', color: '#FAF8F4', fontWeight: 600, fontSize: 14.5, border: 'none' }}>
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64' };

const inputStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 8,
  border: '1px solid #2B2724',
  fontSize: 15,
  background: 'transparent',
  color: '#2B2724',
  fontFamily: 'inherit',
  flex: 1,
  minWidth: 0,
};
