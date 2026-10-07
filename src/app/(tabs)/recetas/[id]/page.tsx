'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { recipeRepo } from '@/data/repositories/recipe-repo';
import { inventoryRepo } from '@/data/repositories/inventory-repo';
import type { InventoryItem } from '@/domain/inventory';
import type { Recipe } from '@/domain/recipe';
import { SLOT_LABELS, missingIngredients, scaleIngredients } from '@/domain/recipe';
import { RecipeFormSheet, type RecipeFormValues } from '@/components/recipe-form-sheet';

export default function RecetaDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [servings, setServings] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);

  const refresh = useCallback(async () => {
    const [recipes, inv] = await Promise.all([recipeRepo.list(), inventoryRepo.list()]);
    const found = recipes.find((r) => r.id === id) ?? null;
    setRecipe(found);
    setInventory(inv);
    setServings((prev) => prev ?? found?.servings ?? null);
  }, [id]);

  useEffect(() => {
    refresh().catch((err) => console.error('[receta] load failed', err));
  }, [refresh]);

  const scaled = useMemo(
    () => (recipe && servings ? scaleIngredients(recipe, servings) : []),
    [recipe, servings]
  );
  const missing = useMemo(
    () => (recipe && servings ? missingIngredients(recipe, inventory, servings) : []),
    [recipe, inventory, servings]
  );
  const missingNames = useMemo(() => new Set(missing.map((m) => m.name.toLowerCase())), [missing]);

  async function handleSave(values: RecipeFormValues) {
    if (!recipe) return;
    await recipeRepo.update({ ...recipe, ...values, updatedAt: new Date().toISOString() });
    setEditing(false);
    setServings(values.servings);
    refresh();
  }

  async function handleDelete() {
    if (!recipe) return;
    await recipeRepo.remove(recipe.id);
    router.push('/recetas');
  }

  if (!recipe || servings === null) {
    return <div style={{ padding: '26px 24px' }} />;
  }

  return (
    <div style={{ position: 'relative', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '26px 24px 16px', borderBottom: '1px solid #E3DED3', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={() => router.push('/recetas')}
          style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', color: '#766F64', fontSize: 13, padding: 0 }}
        >
          ← Recetas
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <h1 style={{ fontSize: 28 }}>{recipe.name}</h1>
          <button
            onClick={() => setEditing(true)}
            style={{ border: '1px solid #2B2724', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, background: 'transparent', color: '#2B2724', flexShrink: 0 }}
          >
            Editar
          </button>
        </div>
        <div style={{ fontSize: 13, color: '#766F64' }}>
          {SLOT_LABELS[recipe.slot]} · {recipe.prepTimeMinutes} min
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#766F64' }}>Porciones</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={() => setServings((s) => Math.max(1, (s ?? 1) - 1))}
              style={{ width: 32, height: 32, borderRadius: 999, border: '1px solid #2B2724', background: 'transparent', color: '#2B2724', fontSize: 16 }}
            >
              −
            </button>
            <span style={{ fontSize: 16, fontWeight: 600, minWidth: 18, textAlign: 'center' }}>{servings}</span>
            <button
              onClick={() => setServings((s) => (s ?? 1) + 1)}
              style={{ width: 32, height: 32, borderRadius: 999, border: '1px solid #2B2724', background: 'transparent', color: '#2B2724', fontSize: 16 }}
            >
              +
            </button>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: 17, marginBottom: 10 }}>Ingredientes</h3>
          {missing.length > 0 && (
            <p style={{ fontSize: 12.5, color: '#A8412B', marginBottom: 10 }}>Te falta {missing.length}</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scaled.map((ing, i) => {
              const falta = missingNames.has(ing.name.toLowerCase());
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: falta ? '#A8412B' : '#2B2724' }}>
                  <span>{ing.name}</span>
                  <span>
                    {ing.quantity} {ing.unit} {falta && '· te falta'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: 17, marginBottom: 10 }}>Pasos</h3>
          <ol style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 20, fontSize: 14, color: '#2B2724' }}>
            {recipe.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      </div>

      {editing && (
        <RecipeFormSheet initial={recipe} onSave={handleSave} onDelete={handleDelete} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
