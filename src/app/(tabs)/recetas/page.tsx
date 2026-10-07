'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { recipeRepo } from '@/data/repositories/recipe-repo';
import type { MealSlot, Recipe } from '@/domain/recipe';
import { SLOT_LABELS, filterRecipesByQuery } from '@/domain/recipe';
import { RecipeRow } from '@/components/recipe-row';
import { RecipeFormSheet, type RecipeFormValues } from '@/components/recipe-form-sheet';

type Tab = 'todo' | MealSlot;

const TABS: { id: Tab; label: string }[] = [
  { id: 'todo', label: 'Todo' },
  { id: 'D', label: SLOT_LABELS.D },
  { id: 'M', label: SLOT_LABELS.M },
  { id: 'A', label: SLOT_LABELS.A },
  { id: 'O', label: SLOT_LABELS.O },
  { id: 'C', label: SLOT_LABELS.C },
];

export default function RecetasPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [tab, setTab] = useState<Tab>('todo');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setRecipes(await recipeRepo.list());
  }, []);

  useEffect(() => {
    refresh().catch((err) => console.error('[recetas] list failed', err));
  }, [refresh]);

  const filtered = useMemo(() => {
    const byTab = tab === 'todo' ? recipes : recipes.filter((r) => r.slot === tab);
    return filterRecipesByQuery(byTab, query);
  }, [recipes, tab, query]);

  async function handleCreate(values: RecipeFormValues) {
    await recipeRepo.add({ id: crypto.randomUUID(), ...values, updatedAt: new Date().toISOString() });
    setCreating(false);
    refresh();
  }

  return (
    <div style={{ position: 'relative', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '26px 24px 12px', borderBottom: '1px solid #E3DED3', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <h1 style={{ fontSize: 32 }}>Recetas</h1>
            <div style={{ fontSize: 13, color: '#766F64' }}>
              {recipes.length} receta{recipes.length === 1 ? '' : 's'}
            </div>
          </div>
          <button
            onClick={() => setCreating(true)}
            aria-label="Agregar receta"
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              border: '1px solid #2B2724',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              background: 'transparent',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2B2724" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #2B2724', padding: '7px 2px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#766F64" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar receta"
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#2B2724', flex: 1 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 20, overflowX: 'auto' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                fontSize: 13,
                fontWeight: tab === t.id ? 600 : 500,
                color: tab === t.id ? '#2B2724' : '#766F64',
                borderBottom: tab === t.id ? '2px solid #A8412B' : '2px solid transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                padding: '12px 0 8px',
                whiteSpace: 'nowrap',
                background: 'transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 24px 24px' }}>
        {filtered.length > 0 ? (
          filtered.map((r) => <RecipeRow key={r.id} recipe={r} onClick={() => router.push(`/recetas/${r.id}`)} />)
        ) : (
          <div style={{ padding: '60px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <p style={{ fontSize: 14, color: '#766F64' }}>Tu biblioteca está vacía.</p>
            <button
              onClick={() => setCreating(true)}
              style={{
                padding: '12px 20px',
                borderRadius: 10,
                background: '#2B2724',
                color: '#FAF8F4',
                fontWeight: 600,
                fontSize: 14,
                border: 'none',
              }}
            >
              Agregar primera receta
            </button>
          </div>
        )}
      </div>

      {creating && <RecipeFormSheet onSave={handleCreate} onClose={() => setCreating(false)} />}
    </div>
  );
}
