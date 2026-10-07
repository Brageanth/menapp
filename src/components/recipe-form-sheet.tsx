'use client';

import { useState } from 'react';
import type { MealSlot, Recipe, RecipeIngredient } from '@/domain/recipe';
import { SLOT_LABELS } from '@/domain/recipe';

export interface RecipeFormValues {
  name: string;
  slot: MealSlot;
  prepTimeMinutes: number;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  proteinTag?: string;
}

const SLOTS: MealSlot[] = ['D', 'M', 'A', 'O', 'C'];

export function RecipeFormSheet({
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  initial?: Recipe;
  onSave: (values: RecipeFormValues) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slot, setSlot] = useState<MealSlot>(initial?.slot ?? 'A');
  const [prepTimeMinutes, setPrepTimeMinutes] = useState(String(initial?.prepTimeMinutes ?? ''));
  const [servings, setServings] = useState(String(initial?.servings ?? 2));
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    initial?.ingredients ?? [{ name: '', quantity: 0, unit: '' }]
  );
  const [stepsText, setStepsText] = useState((initial?.steps ?? ['']).join('\n'));
  const [proteinTag, setProteinTag] = useState(initial?.proteinTag ?? '');

  function updateIngredient(index: number, patch: Partial<RecipeIngredient>) {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)));
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, { name: '', quantity: 0, unit: '' }]);
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      slot,
      prepTimeMinutes: Number(prepTimeMinutes) || 0,
      servings: Number(servings) || 1,
      ingredients: ingredients
        .filter((ing) => ing.name.trim())
        .map((ing) => ({ ...ing, name: ing.name.trim(), unit: ing.unit.trim() })),
      steps: stepsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      proteinTag: proteinTag.trim() || undefined,
    });
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(43,39,36,0.4)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 10,
      }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          background: '#FAF8F4',
          borderRadius: '16px 16px 0 0',
          padding: '24px 24px calc(24px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          maxHeight: '85%',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ fontSize: 24 }}>{initial ? 'Editar receta' : 'Nueva receta'}</h2>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64' }}>
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus style={inputStyle} />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64' }}>
          Slot
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SLOTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSlot(s)}
                style={{
                  flex: '1 0 auto',
                  padding: '10px 8px',
                  borderRadius: 8,
                  border: slot === s ? '1px solid #2B2724' : '1px solid #E3DED3',
                  background: slot === s ? '#2B2724' : 'transparent',
                  color: slot === s ? '#FAF8F4' : '#2B2724',
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                {SLOT_LABELS[s]}
              </button>
            ))}
          </div>
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64', flex: 1 }}>
            Tiempo (min)
            <input
              type="number"
              value={prepTimeMinutes}
              onChange={(e) => setPrepTimeMinutes(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64', flex: 1 }}>
            Porciones base
            <input type="number" value={servings} onChange={(e) => setServings(e.target.value)} style={inputStyle} />
          </label>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64' }}>
          Proteína (opcional)
          <input
            value={proteinTag}
            onChange={(e) => setProteinTag(e.target.value)}
            placeholder="pollo, res, lenteja..."
            style={inputStyle}
          />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#766F64' }}>Ingredientes</span>
          {ingredients.map((ing, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <input
                value={ing.name}
                onChange={(e) => updateIngredient(i, { name: e.target.value })}
                placeholder="Nombre"
                style={{ ...inputStyle, flex: 2 }}
              />
              <input
                type="number"
                step="any"
                value={ing.quantity || ''}
                onChange={(e) => updateIngredient(i, { quantity: Number(e.target.value) || 0 })}
                placeholder="Cant."
                style={{ ...inputStyle, flex: 1, minWidth: 0 }}
              />
              <input
                value={ing.unit}
                onChange={(e) => updateIngredient(i, { unit: e.target.value })}
                placeholder="Unidad"
                style={{ ...inputStyle, flex: 1, minWidth: 0 }}
              />
              <button
                type="button"
                onClick={() => removeIngredient(i)}
                aria-label="Quitar ingrediente"
                style={{ border: 'none', background: 'transparent', color: '#A8412B', fontSize: 18, padding: '0 4px' }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addIngredient}
            style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', color: '#2B2724', fontSize: 13, fontWeight: 600, padding: '4px 0' }}
          >
            + Agregar ingrediente
          </button>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64' }}>
          Pasos (uno por línea)
          <textarea
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            rows={5}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </label>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          {initial && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              style={{
                padding: 14,
                borderRadius: 10,
                background: 'transparent',
                color: '#A8412B',
                fontWeight: 600,
                fontSize: 14.5,
                border: '1px solid #A8412B',
              }}
            >
              Eliminar
            </button>
          )}
          <button
            type="submit"
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 10,
              background: '#2B2724',
              color: '#FAF8F4',
              fontWeight: 600,
              fontSize: 14.5,
              border: 'none',
            }}
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 8,
  border: '1px solid #2B2724',
  fontSize: 15,
  background: 'transparent',
  color: '#2B2724',
  fontFamily: 'inherit',
};
