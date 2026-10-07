'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { menuRepo } from '@/data/repositories/menu-repo';
import { recipeRepo } from '@/data/repositories/recipe-repo';
import type { MenuDay } from '@/domain/menu';
import { todayDate } from '@/domain/menu';
import type { MealSlot, Recipe } from '@/domain/recipe';
import { SLOT_LABELS } from '@/domain/recipe';

const SLOTS: MealSlot[] = ['D', 'M', 'A', 'O', 'C'];

export default function HoyPage() {
  const router = useRouter();
  const [menuDays, setMenuDays] = useState<MenuDay[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    setToday(todayDate());
  }, []);

  const refresh = useCallback(async () => {
    const [m, r] = await Promise.all([menuRepo.list(), recipeRepo.list()]);
    setMenuDays(m);
    setRecipes(r);
  }, []);

  useEffect(() => {
    refresh().catch((err) => console.error('[hoy] list failed', err));
  }, [refresh]);

  const recipeMap = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const todayAssignments = useMemo(() => (today ? menuDays.filter((m) => m.date === today) : []), [menuDays, today]);

  return (
    <div style={{ padding: '26px 24px' }}>
      <h1 style={{ fontSize: 38 }}>Hoy</h1>

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SLOTS.map((slot) => {
          const assignment = todayAssignments.find((m) => m.slot === slot);
          const recipe = assignment?.recipeId ? recipeMap.get(assignment.recipeId) : null;
          return (
            <button
              key={slot}
              onClick={() => (recipe ? router.push(`/recetas/${recipe.id}`) : router.push('/semana'))}
              style={{
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: 10,
                border: recipe ? '1px solid #2B2724' : '1px dashed #CFC8BA',
                background: 'transparent',
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: '#766F64' }}>{SLOT_LABELS[slot]}</div>
                <div style={{ fontSize: 15, color: recipe ? '#2B2724' : '#CFC8BA', marginTop: 2 }}>
                  {recipe ? recipe.name : 'Sin asignar'}
                </div>
              </div>
              {recipe && <span style={{ fontSize: 12.5, color: '#766F64' }}>{recipe.prepTimeMinutes} min</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
