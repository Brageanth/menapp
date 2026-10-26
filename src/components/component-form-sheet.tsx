'use client';

import { useState } from 'react';
import type { Component, ComponentOrigin, MacrosBasis, NewComponentInput, RoleId, WeightState } from '@/domain/component';
import { SEED_ROLES, portionLooksLikeCount, validateNewComponent } from '@/domain/component';
import { ALL_SLOTS, SLOT_LABELS, type MealSlot } from '@/domain/meal-slot';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';

export function ComponentFormSheet({
  initial,
  prefill,
  onSave,
  onArchive,
  onClose,
  onBackToDescription,
}: {
  initial?: Component;
  prefill?: NewComponentInput;
  onSave: (values: NewComponentInput) => void;
  onArchive?: () => void;
  onClose: () => void;
  onBackToDescription?: () => void;
}) {
  const base = prefill ?? initial;
  const [name, setName] = useState(base?.name ?? '');
  const [roles, setRoles] = useState<RoleId[]>(base?.roles ?? []);
  const [contributesRoles, setContributesRoles] = useState<RoleId[] | undefined>(base?.contributesRoles);
  const [origin, setOrigin] = useState<ComponentOrigin>(base?.origin ?? 'simple');
  const [unit, setUnit] = useState(base?.unit ?? 'g');
  const [weightState, setWeightState] = useState<WeightState>(base?.weightState ?? 'crudo');
  const [typical, setTypical] = useState(String(base?.portion.typical ?? 100));
  const [min, setMin] = useState(String(base?.portion.min ?? 50));
  const [max, setMax] = useState(String(base?.portion.max ?? 300));
  const [step, setStep] = useState(String(base?.portion.step ?? 10));
  const [macrosBasis, setMacrosBasis] = useState<MacrosBasis>(base?.macrosBasis ?? 'per100g');
  const [kcal, setKcal] = useState(String(base?.macros.kcal ?? ''));
  const [protein, setProtein] = useState(String(base?.macros.protein ?? ''));
  const [carbs, setCarbs] = useState(String(base?.macros.carbs ?? ''));
  const [fat, setFat] = useState(String(base?.macros.fat ?? ''));
  const [favorite, setFavorite] = useState(base?.favorite ?? false);
  const [ingredientsText, setIngredientsText] = useState(
    base?.ingredients?.map((i) => `${i.quantity} ${i.unit} ${i.name}`).join('\n') ?? ''
  );
  const [stepsText, setStepsText] = useState(base?.steps?.join('\n') ?? '');
  const [showMore, setShowMore] = useState(false);
  const [batchable, setBatchable] = useState(base?.batchable ?? false);
  const [cookedShelfLifeDays, setCookedShelfLifeDays] = useState(String(base?.cookedShelfLifeDays ?? ''));
  const [notes, setNotes] = useState(base?.notes ?? '');
  const [shoppingName, setShoppingName] = useState(base?.shoppingName ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const [typicalSlots, setTypicalSlots] = useState<MealSlot[] | undefined>(base?.typicalSlots);
  // Sin control propio en este form (todavía) — se preservan sin cambios para no perder lo que infirió la IA o lo que ya tenía el componente.
  const [flavorProfile] = useState(base?.flavorProfile);
  const [temperature] = useState(base?.temperature);
  const [effort] = useState(base?.effort);
  const [isCompleteDish] = useState(base?.isCompleteDish);

  useLockBodyScroll(onClose);

  function toggleRole(role: RoleId) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
    setContributesRoles((prev) => {
      if (!prev?.includes(role)) return prev;
      const next = prev.filter((r) => r !== role);
      return next.length > 0 ? next : undefined;
    });
  }

  function toggleContributesRole(role: RoleId) {
    setContributesRoles((prev) => {
      const current = prev ?? [];
      const next = current.includes(role) ? current.filter((r) => r !== role) : [...current, role];
      return next.length > 0 ? next : undefined;
    });
  }

  function toggleSlot(slot: MealSlot) {
    setTypicalSlots((prev) => {
      const current = prev ?? [];
      return current.includes(slot) ? current.filter((s) => s !== slot) : [...current, slot];
    });
  }

  function setMeasureMode(mode: 'peso' | 'unidad') {
    if (mode === 'peso') {
      setMacrosBasis('per100g');
      if (unit === 'unidad') setUnit('g');
    } else {
      setMacrosBasis('perUnit');
      if (unit === 'g' || unit === 'ml') setUnit('unidad');
    }
  }

  const looksLikeCount = portionLooksLikeCount({ macrosBasis, unit, portion: { typical: Number(typical), min: Number(min), max: Number(max), step: Number(step) } });
  const unitLabel = unit || 'unidad';

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
      contributesRoles,
      origin,
      unit: unit.trim(),
      portion: { typical: Number(typical), min: Number(min), max: Number(max), step: Number(step) },
      weightState,
      macrosBasis,
      macros: { kcal: Number(kcal) || 0, protein: Number(protein) || 0, carbs: Number(carbs) || 0, fat: Number(fat) || 0 },
      isTreat: false,
      favorite,
      batchable: origin === 'preparado' ? batchable : undefined,
      cookedShelfLifeDays: cookedShelfLifeDays ? Number(cookedShelfLifeDays) : undefined,
      notes: notes.trim() || undefined,
      ingredients: origin === 'preparado' ? parseIngredients() : undefined,
      // "" (no undefined) cuando se vació un nombre que ya existía, para que el borrado también se sincronice.
      shoppingName: origin === 'simple' && shoppingName.trim() ? shoppingName.trim() : base?.shoppingName ? '' : undefined,
      steps: origin === 'preparado' ? stepsText.split('\n').map((s) => s.trim()).filter(Boolean) : undefined,
      typicalSlots: typicalSlots && typicalSlots.length > 0 ? typicalSlots : undefined,
      flavorProfile,
      temperature,
      effort,
      isCompleteDish,
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

        {prefill && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12.5, color: '#3F7D4F', background: 'rgba(63,125,79,0.08)', borderRadius: 8, padding: '10px 12px' }}>
            <span>Generado por IA — revisá los campos antes de guardar.</span>
            {onBackToDescription && (
              <button type="button" onClick={onBackToDescription} style={{ fontSize: 12.5, color: '#3F7D4F', background: 'none', border: 'none', padding: 0, fontWeight: 600, flexShrink: 0 }}>
                Redescribir
              </button>
            )}
          </div>
        )}

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

        <div style={labelStyle}>
          También cubre (opcional — no lo vuelve elegible para estos roles, solo evita sumar otro
          componente si ya está en la comida. Ej. un perro caliente con papas
          (rol Proteína) puede marcar aquí Base/Verdura para que no se agregue arroz ni brócoli aparte.)
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SEED_ROLES.filter((r) => !roles.includes(r.id)).map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => toggleContributesRole(r.id)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  border: contributesRoles?.includes(r.id) ? '1px solid #2B2724' : '1px solid #E3DED3',
                  background: contributesRoles?.includes(r.id) ? '#2B2724' : 'transparent',
                  color: contributesRoles?.includes(r.id) ? '#FAF8F4' : '#2B2724',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div style={labelStyle}>
          Comidas (vacío = cualquiera)
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ALL_SLOTS.map((slot) => (
              <button
                type="button"
                key={slot}
                onClick={() => toggleSlot(slot)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  border: typicalSlots?.includes(slot) ? '1px solid #2B2724' : '1px solid #E3DED3',
                  background: typicalSlots?.includes(slot) ? '#2B2724' : 'transparent',
                  color: typicalSlots?.includes(slot) ? '#FAF8F4' : '#2B2724',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {SLOT_LABELS[slot]}
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

        {origin === 'simple' && (
          <label style={labelStyle}>
            Se compra como (opcional)
            <input
              value={shoppingName}
              onChange={(e) => setShoppingName(e.target.value)}
              placeholder="ej. huevo"
              style={inputStyle}
            />
            <span style={{ fontSize: 12 }}>Si no se compra con este nombre (huevo frito se compra como huevo). Si lleva varios productos, separalos con coma (lechuga, tomate).</span>
          </label>
        )}

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

        <div style={labelStyle}>
          Cómo se mide
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setMeasureMode('peso')}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 8,
                border: macrosBasis === 'per100g' ? '1px solid #2B2724' : '1px solid #E3DED3',
                background: macrosBasis === 'per100g' ? '#2B2724' : 'transparent',
                color: macrosBasis === 'per100g' ? '#FAF8F4' : '#2B2724',
                fontSize: 13.5,
                fontWeight: 600,
              }}
            >
              Por peso/volumen
            </button>
            <button
              type="button"
              onClick={() => setMeasureMode('unidad')}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 8,
                border: macrosBasis === 'perUnit' ? '1px solid #2B2724' : '1px solid #E3DED3',
                background: macrosBasis === 'perUnit' ? '#2B2724' : 'transparent',
                color: macrosBasis === 'perUnit' ? '#FAF8F4' : '#2B2724',
                fontSize: 13.5,
                fontWeight: 600,
              }}
            >
              Por unidad entera
            </button>
          </div>
          <span style={{ fontSize: 12, color: '#766F64' }}>
            {macrosBasis === 'per100g'
              ? `Vas a cargar los macros por cada 100${unit || 'g'}, y la porción se sirve en ${unit || 'g'}. Usalo para alimentos que se pesan o miden (carnes, arroz, líquidos).`
              : `Vas a cargar los macros por 1 ${unit || 'unidad'} completa, y la porción se sirve en unidades enteras. Usalo para alimentos que se sirven "enteros" (una fruta, un huevo, una porción prearmada).`}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ ...labelStyle, flex: 1 }}>
            Unidad
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder={macrosBasis === 'per100g' ? 'g, ml' : 'unidad, huevo, taza'}
              style={inputStyle}
            />
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

        <fieldset style={fieldsetStyle}>
          <legend style={legendStyle}>Cuánto se sirve</legend>
          <p style={hintStyle}>
            Armar propone la cantidad habitual y puede subirla o bajarla entre el mínimo y el máximo, de a un salto, para
            cumplir tus macros del día.
          </p>
          <div style={gridStyle}>
            <NumberField label="Habitual" suffix={unitLabel} value={typical} onChange={setTypical} />
            <NumberField label="Salto" suffix={unitLabel} value={step} onChange={setStep} />
            <NumberField label="Mínimo" suffix={unitLabel} value={min} onChange={setMin} />
            <NumberField label="Máximo" suffix={unitLabel} value={max} onChange={setMax} />
          </div>
          {looksLikeCount && (
            <div style={{ fontSize: 12, color: '#A8412B', background: 'rgba(168,65,43,0.08)', borderRadius: 8, padding: '8px 10px' }}>
              Esta porción parece un conteo (1 a {max}), no un peso en {unitLabel}. Si este componente se sirve entero, cambiá &ldquo;Cómo se mide&rdquo; arriba a &ldquo;Por unidad entera&rdquo;.
            </div>
          )}
        </fieldset>

        <fieldset style={fieldsetStyle}>
          <legend style={legendStyle}>Aporte nutricional {macrosBasis === 'per100g' ? `por cada 100 ${unitLabel}` : `de 1 ${unitLabel}`}</legend>
          <p style={hintStyle}>
            {macrosBasis === 'per100g'
              ? 'Los valores de la etiqueta, por 100. Armar los escala solo a la cantidad que se sirve.'
              : 'Los valores de una unidad completa. Armar los multiplica por la cantidad de unidades.'}
          </p>
          <div style={gridStyle}>
            <NumberField label="Calorías" suffix="kcal" value={kcal} onChange={setKcal} />
            <NumberField label="Proteína" suffix="g" value={protein} onChange={setProtein} />
            <NumberField label="Carbohidratos" suffix="g" value={carbs} onChange={setCarbs} />
            <NumberField label="Grasa" suffix="g" value={fat} onChange={setFat} />
          </div>
        </fieldset>

        <div style={{ display: 'flex', gap: 16 }}>
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

function NumberField({ label, suffix, value, onChange }: { label: string; suffix: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: '#766F64', minWidth: 0 }}>
      {label}
      <span style={{ position: 'relative', display: 'flex' }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type="number"
          inputMode="decimal"
          style={{ ...inputStyle, paddingRight: 46 }}
        />
        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12.5, color: '#766F64', pointerEvents: 'none' }}>
          {suffix}
        </span>
      </span>
    </label>
  );
}

const fieldsetStyle: React.CSSProperties = { border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 };
const legendStyle: React.CSSProperties = { padding: 0, marginBottom: 4, fontSize: 13.5, fontWeight: 600, color: '#2B2724' };
const hintStyle: React.CSSProperties = { margin: 0, fontSize: 12, lineHeight: 1.45, color: '#766F64' };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };

export const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64' };

export const inputStyle: React.CSSProperties = {
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
