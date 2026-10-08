'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { recipeRepo } from '@/data/repositories/recipe-repo';
import { recipeVersionRepo } from '@/data/repositories/recipe-version-repo';
import { inventoryRepo } from '@/data/repositories/inventory-repo';
import { profileRepo } from '@/data/repositories/profile-repo';
import { shoppingListRepo } from '@/data/repositories/shopping-list-repo';
import type { InventoryItem } from '@/domain/inventory';
import type { Profile } from '@/domain/profile';
import type { Recipe, RecipeIngredient, RecipeVersion } from '@/domain/recipe';
import { SLOT_LABELS, missingIngredients, scaleIngredients, targetServingsForGoal } from '@/domain/recipe';
import { guessCategory } from '@/domain/shopping-list';
import type { RecipeFormValues } from '@/components/recipe-form-sheet';

/** Las 3 sheets de esta pantalla solo se montan al abrirse — fuera del bundle inicial. */
const RecipeFormSheet = dynamic(() => import('@/components/recipe-form-sheet').then((m) => m.RecipeFormSheet));
const AjustarRecetaSheet = dynamic(() => import('@/components/ajustar-receta-sheet').then((m) => m.AjustarRecetaSheet));
const CompartirSheet = dynamic(() => import('@/components/compartir-sheet').then((m) => m.CompartirSheet));

const PERSON_LABELS: Record<Profile['personLabel'], string> = { yo: 'Yo', pareja: 'Pareja' };

export default function RecetaDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [servings, setServings] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [versions, setVersions] = useState<RecipeVersion[]>([]);

  const refresh = useCallback(async () => {
    const [recipes, inv, profileList, versionList] = await Promise.all([
      recipeRepo.list(),
      inventoryRepo.list(),
      profileRepo.list(),
      recipeVersionRepo.listByRecipe(id),
    ]);
    const found = recipes.find((r) => r.id === id) ?? null;
    setRecipe(found);
    setInventory(inv);
    setProfiles(profileList);
    setVersions(versionList);
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

  async function handleSaveToLibrary() {
    if (!recipe) return;
    await recipeRepo.update({ ...recipe, inLibrary: true, updatedAt: new Date().toISOString() });
    refresh();
  }

  async function addMissingToShoppingList(missing: RecipeIngredient[]) {
    if (missing.length === 0) return;
    const now = new Date().toISOString();
    const existing = await shoppingListRepo.list();
    for (const ing of missing) {
      const key = ing.name.toLowerCase().trim();
      const match = existing.find((e) => e.name.toLowerCase().trim() === key);
      if (match) {
        await shoppingListRepo.update({ ...match, quantity: match.quantity + ing.quantity, updatedAt: now });
      } else {
        await shoppingListRepo.add({
          id: crypto.randomUUID(),
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          category: guessCategory(ing.name),
          purchased: false,
          updatedAt: now,
        });
      }
    }
  }

  async function handleSaveAsNewVersion(
    changes: Pick<Recipe, 'ingredients' | 'steps'>,
    missing: RecipeIngredient[],
    note: string
  ) {
    if (!recipe) return;
    const now = new Date().toISOString();
    await recipeVersionRepo.add({
      id: crypto.randomUUID(),
      recipeId: recipe.id,
      version: recipe.version ?? 1,
      name: recipe.name,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      note,
      createdAt: now,
    });
    await recipeRepo.update({ ...recipe, ...changes, version: (recipe.version ?? 1) + 1, updatedAt: now });
    await addMissingToShoppingList(missing);
    setAdjusting(false);
    refresh();
  }

  async function handleSaveAsVariant(
    changes: Pick<Recipe, 'ingredients' | 'steps'>,
    missing: RecipeIngredient[],
    note: string
  ) {
    if (!recipe) return;
    const now = new Date().toISOString();
    const variant: Recipe = {
      ...recipe,
      id: crypto.randomUUID(),
      name: `${recipe.name} (${note.length > 24 ? 'variante' : note})`,
      ...changes,
      version: 1,
      parentRecipeId: recipe.id,
      updatedAt: now,
    };
    await recipeRepo.add(variant);
    await addMissingToShoppingList(missing);
    setAdjusting(false);
    router.push(`/recetas/${variant.id}`);
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
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => setSharing(true)}
              style={{ border: '1px solid #E3DED3', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, background: 'transparent', color: '#766F64' }}
            >
              Compartir
            </button>
            <button
              onClick={() => setAdjusting(true)}
              style={{ border: '1px solid #2B2724', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, background: 'transparent', color: '#2B2724' }}
            >
              Ajustar con IA
            </button>
            <button
              onClick={() => setEditing(true)}
              style={{ border: '1px solid #2B2724', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, background: 'transparent', color: '#2B2724' }}
            >
              Editar
            </button>
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#766F64' }}>
          {SLOT_LABELS[recipe.slot]} · {recipe.prepTimeMinutes} min · v{recipe.version ?? 1}
        </div>

        {recipe.inLibrary === false && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '11px 12px',
              background: '#F6E4DC',
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            <span>Generada para el menú, todavía no está en tu Biblioteca.</span>
            <button
              onClick={handleSaveToLibrary}
              style={{ border: 'none', background: '#2B2724', color: '#FAF8F4', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              Guardar
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#766F64' }}>Porciones</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                aria-label="Menos porciones"
                onClick={() => setServings((s) => Math.max(0.5, (s ?? 1) - 1))}
                style={{ width: 32, height: 32, borderRadius: 999, border: '1px solid #2B2724', background: 'transparent', color: '#2B2724', fontSize: 16 }}
              >
                −
              </button>
              <span style={{ fontSize: 16, fontWeight: 600, minWidth: 18, textAlign: 'center' }}>{servings}</span>
              <button
                aria-label="Más porciones"
                onClick={() => setServings((s) => (s ?? 1) + 1)}
                style={{ width: 32, height: 32, borderRadius: 999, border: '1px solid #2B2724', background: 'transparent', color: '#2B2724', fontSize: 16 }}
              >
                +
              </button>
            </div>
          </div>

          {recipe.caloriesPerServing ? (
            <p style={{ fontSize: 12.5, color: '#766F64' }}>
              ≈ {Math.round(recipe.caloriesPerServing * (servings ?? 0))} kcal en total para {servings} porción
              {servings === 1 ? '' : 'es'}
            </p>
          ) : (
            <p style={{ fontSize: 12, color: '#A8A196' }}>
              Sin kcal por porción cargadas — editá la receta para escalar según metas.
            </p>
          )}
        </div>

        {recipe.caloriesPerServing && profiles.filter((p) => p.kcalTarget).length > 0 && (
          <div>
            <h3 style={{ fontSize: 17 }}>Cantidades por persona</h3>
            <p style={{ fontSize: 12.5, color: '#766F64', margin: '3px 0 2px' }}>
              Porciones sugeridas según la meta de cada perfil.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {profiles
                .filter((p) => p.kcalTarget)
                .map((p, idx) => {
                  const target = targetServingsForGoal(recipe, p.kcalTarget!);
                  if (target === null) return null;
                  const applied = servings === target;
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '11px 0',
                        borderTop: idx === 0 ? '1px solid #2B2724' : 'none',
                        borderBottom: '1px solid #E3DED3',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <b style={{ fontSize: 13.5, width: 58, flexShrink: 0 }}>{PERSON_LABELS[p.personLabel]}</b>
                        <span style={{ fontSize: 13.5, color: '#766F64' }}>
                          {target} porción{target === 1 ? '' : 'es'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setServings(target)}
                        style={{
                          border: '1px solid #2B2724',
                          borderRadius: 999,
                          padding: '5px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          background: applied ? '#2B2724' : 'transparent',
                          color: applied ? '#FAF8F4' : '#2B2724',
                          flexShrink: 0,
                        }}
                      >
                        {applied ? 'Aplicado' : 'Usar'}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

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

        {versions.length > 0 && (
          <div>
            <h3 style={{ fontSize: 17, marginBottom: 10 }}>Historial de ajustes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {versions.map((v) => (
                <div key={v.id} style={{ fontSize: 13, color: '#766F64' }}>
                  <span style={{ fontWeight: 600, color: '#2B2724' }}>v{v.version}</span> — {v.note}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {editing && (
        <RecipeFormSheet initial={recipe} onSave={handleSave} onDelete={handleDelete} onClose={() => setEditing(false)} />
      )}
      {adjusting && (
        <AjustarRecetaSheet
          recipe={recipe}
          inventory={inventory}
          onSaveAsNewVersion={handleSaveAsNewVersion}
          onSaveAsVariant={handleSaveAsVariant}
          onClose={() => setAdjusting(false)}
        />
      )}
      {sharing && (
        <CompartirSheet
          dates={[]}
          today={null}
          menuDays={[]}
          recipes={[recipe]}
          shoppingItems={[]}
          initialTab="receta"
          initialRecipeId={recipe.id}
          allowedTabs={['receta']}
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );
}
