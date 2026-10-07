'use client';

import { useState } from 'react';
import type { RecipeAdjustment } from '@/domain/recipe-adjustment';
import { applyRecipeAdjustment, newIngredientsMissingFromInventory } from '@/domain/recipe-adjustment';
import type { InventoryItem } from '@/domain/inventory';
import type { Recipe } from '@/domain/recipe';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';

export function AjustarRecetaSheet({
  recipe,
  inventory,
  onSaveAsNewVersion,
  onSaveAsVariant,
  onClose,
}: {
  recipe: Recipe;
  inventory: InventoryItem[];
  onSaveAsNewVersion: (changes: Pick<Recipe, 'ingredients' | 'steps'>, missing: Recipe['ingredients'], note: string) => void;
  onSaveAsVariant: (changes: Pick<Recipe, 'ingredients' | 'steps'>, missing: Recipe['ingredients'], note: string) => void;
  onClose: () => void;
}) {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState<RecipeAdjustment | null>(null);

  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  useLockBodyScroll(onClose);

  async function handleAdjust() {
    if (offline || loading || !instruction.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/adjust-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe: { name: recipe.name, ingredients: recipe.ingredients, steps: recipe.steps },
          instruction,
        }),
      });
      if (!res.ok) throw new Error('fallo el ajuste');
      const data = (await res.json()) as RecipeAdjustment;
      setAdjustment(data);
    } catch {
      setError('No se pudo ajustar la receta. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  function save(mode: 'version' | 'variant') {
    if (!adjustment) return;
    const changes = applyRecipeAdjustment(recipe, adjustment);
    const missing = newIngredientsMissingFromInventory(adjustment.ingredientsDiff, inventory);
    if (mode === 'version') onSaveAsNewVersion(changes, missing, adjustment.summary);
    else onSaveAsVariant(changes, missing, adjustment.summary);
  }

  const diff = adjustment?.ingredientsDiff;
  const missingFromInventory = adjustment && diff ? newIngredientsMissingFromInventory(diff, inventory) : [];

  return (
    <div
      style={{ position: 'fixed', inset: 0, height: '100dvh', background: 'rgba(43,39,36,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }}
      onClick={onClose}
    >
      <div
        role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          background: '#FAF8F4',
          borderRadius: '16px 16px 0 0',
          padding: '24px 24px calc(24px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          maxHeight: '85dvh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ fontSize: 24 }}>Ajustar con IA</h2>
        <p style={{ fontSize: 13, color: '#766F64', marginTop: -6 }}>
          Describí el cambio en lenguaje natural, por ejemplo &quot;cambiá el pollo por tofu&quot; o &quot;hacela sin lácteos&quot;.
        </p>

        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Qué querés cambiar…"
          rows={3}
          style={{ padding: 12, borderRadius: 10, border: '1px solid #E3DED3', fontSize: 14, resize: 'vertical' }}
        />

        {offline && <p style={{ fontSize: 13, color: '#A8412B' }}>Necesitás conexión para ajustar la receta.</p>}
        {error && <p style={{ fontSize: 13, color: '#A8412B' }}>{error}</p>}

        {!adjustment && (
          <button
            type="button"
            onClick={handleAdjust}
            disabled={offline || loading || !instruction.trim()}
            style={{
              padding: 14,
              borderRadius: 10,
              background: offline || loading || !instruction.trim() ? '#CFC8BA' : '#2B2724',
              color: '#FAF8F4',
              fontWeight: 600,
              fontSize: 14.5,
              border: 'none',
            }}
          >
            {loading ? 'Ajustando…' : 'Ajustar'}
          </button>
        )}

        {adjustment && diff && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 14, fontWeight: 600 }}>{adjustment.summary}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {diff.changed.map((ing, i) => (
                <div
                  key={`chg-${i}`}
                  style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 12px', borderRadius: 8, background: '#FAF8F4', border: '1px solid #E3DED3' }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: '#766F64',
                      background: '#F1EBDF',
                      borderRadius: 999,
                      padding: '2px 8px',
                      marginTop: 1,
                    }}
                  >
                    Cambia
                  </span>
                  <span style={{ fontSize: 13.5, lineHeight: 1.4 }}>
                    <b>{ing.name}</b> ahora {ing.quantity} {ing.unit}
                  </span>
                </div>
              ))}
              {diff.added.map((ing, i) => (
                <div
                  key={`add-${i}`}
                  style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 12px', borderRadius: 8, background: '#F6E4DC' }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: '#6E4B40',
                      background: '#FAF8F4',
                      borderRadius: 999,
                      padding: '2px 8px',
                      marginTop: 1,
                    }}
                  >
                    Agrega
                  </span>
                  <span style={{ fontSize: 13.5, lineHeight: 1.4, color: '#6E4B40' }}>
                    <b>{ing.name}</b>, {ing.quantity} {ing.unit}
                  </span>
                </div>
              ))}
              {diff.removed.map((name, i) => (
                <div
                  key={`rem-${i}`}
                  style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 12px', borderRadius: 8, background: '#FAF8F4', border: '1px solid #E3DED3' }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: '#766F64',
                      background: '#F1EBDF',
                      borderRadius: 999,
                      padding: '2px 8px',
                      marginTop: 1,
                    }}
                  >
                    Quita
                  </span>
                  <span style={{ fontSize: 13.5, lineHeight: 1.4, color: '#766F64', textDecoration: 'line-through' }}>
                    {name}
                  </span>
                </div>
              ))}
              {adjustment.newSteps && (
                <p style={{ fontSize: 12.5, color: '#766F64', margin: 0 }}>Los pasos también se actualizan.</p>
              )}
            </div>

            {missingFromInventory.length > 0 && (
              <div
                style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '11px 12px', background: '#F6E4DC', borderRadius: 8 }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: '#A8412B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FAF8F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {missingFromInventory.map((ing, i) => (
                    <p key={`missing-${i}`} style={{ fontSize: 13, lineHeight: 1.35, color: '#2B2724', margin: 0 }}>
                      No tienes <b>{ing.name}</b>, lo agrego a tu lista de compras.
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                onClick={() => save('version')}
                style={{ padding: 14, borderRadius: 10, background: '#2B2724', color: '#FAF8F4', fontWeight: 600, fontSize: 14.5, border: 'none' }}
              >
                Guardar como nueva versión
              </button>
              <button
                type="button"
                onClick={() => save('variant')}
                style={{ padding: 14, borderRadius: 10, background: 'transparent', color: '#2B2724', fontWeight: 600, fontSize: 14.5, border: '1px solid #2B2724' }}
              >
                Guardar como variante nueva
              </button>
              <button
                type="button"
                onClick={() => setAdjustment(null)}
                style={{ padding: 10, borderRadius: 10, background: 'transparent', color: '#766F64', fontWeight: 600, fontSize: 13, border: 'none' }}
              >
                Descartar y pedir otro ajuste
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
