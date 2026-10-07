'use client';

import { useMemo, useState } from 'react';
import type { MenuDay } from '@/domain/menu';
import type { Recipe } from '@/domain/recipe';
import { filterRecipesByQuery } from '@/domain/recipe';
import type { ShoppingListItem } from '@/domain/shopping-list';
import {
  SHARE_DAY_LABELS,
  buildDayShareText,
  buildWeekShareText,
  buildRecipeShareText,
  buildShoppingListShareText,
  shareViaWhatsApp,
} from '@/domain/share';
import { RecipeRow } from './recipe-row';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';

type Tab = 'dia' | 'semana' | 'receta' | 'lista';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dia', label: 'Día' },
  { id: 'semana', label: 'Semana' },
  { id: 'receta', label: 'Receta' },
  { id: 'lista', label: 'Lista' },
];

export function CompartirSheet({
  dates,
  today,
  menuDays,
  recipes,
  shoppingItems,
  initialTab = 'dia',
  initialRecipeId = null,
  allowedTabs = ['dia', 'semana', 'receta', 'lista'],
  onClose,
}: {
  dates: string[];
  today: string | null;
  menuDays: MenuDay[];
  recipes: Recipe[];
  shoppingItems: ShoppingListItem[];
  initialTab?: Tab;
  initialRecipeId?: string | null;
  allowedTabs?: Tab[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(initialRecipeId);
  const [recipeQuery, setRecipeQuery] = useState('');

  useLockBodyScroll(onClose);

  const dayToShare = selectedDate ?? (today && dates.includes(today) ? today : dates[0]) ?? null;
  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === selectedRecipeId) ?? null,
    [recipes, selectedRecipeId]
  );
  const filteredRecipes = useMemo(() => filterRecipesByQuery(recipes, recipeQuery), [recipes, recipeQuery]);

  const text = useMemo(() => {
    if (tab === 'dia') return dayToShare ? buildDayShareText(dayToShare, menuDays, recipes) : '';
    if (tab === 'semana') return buildWeekShareText(dates, menuDays, recipes);
    if (tab === 'receta') return selectedRecipe ? buildRecipeShareText(selectedRecipe) : '';
    return buildShoppingListShareText(shoppingItems);
  }, [tab, dayToShare, menuDays, recipes, dates, selectedRecipe, shoppingItems]);

  const canShare = tab !== 'receta' || !!selectedRecipe;

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        height: '100dvh',
        background: 'rgba(43,39,36,0.4)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 50,
      }}
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
        <h2 style={{ fontSize: 22 }}>Compartir{allowedTabs.length === 1 ? ` ${TABS.find((t) => t.id === allowedTabs[0])?.label.toLowerCase()}` : ''}</h2>

        {allowedTabs.length > 1 && (
        <div style={{ display: 'flex', gap: 6 }}>
          {TABS.filter((t) => allowedTabs.includes(t.id)).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 999,
                border: `1px solid ${tab === t.id ? '#2B2724' : '#E3DED3'}`,
                background: tab === t.id ? '#2B2724' : 'transparent',
                color: tab === t.id ? '#FAF8F4' : '#766F64',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        )}

        {tab === 'dia' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {dates.map((date, i) => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 999,
                  border: `1px solid ${dayToShare === date ? '#2B2724' : '#E3DED3'}`,
                  background: dayToShare === date ? '#2B2724' : 'transparent',
                  color: dayToShare === date ? '#FAF8F4' : '#766F64',
                  fontSize: 12.5,
                }}
              >
                {SHARE_DAY_LABELS[i]} {date.slice(8)}
              </button>
            ))}
          </div>
        )}

        {tab === 'receta' && !selectedRecipe && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              value={recipeQuery}
              onChange={(e) => setRecipeQuery(e.target.value)}
              placeholder="Buscar receta…"
              style={{
                fontSize: 16,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #E3DED3',
                background: 'transparent',
              }}
            />
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {filteredRecipes.map((r) => (
                <RecipeRow key={r.id} recipe={r} onClick={() => setSelectedRecipeId(r.id)} />
              ))}
            </div>
          </div>
        )}

        {tab === 'receta' && selectedRecipe && (
          <button
            onClick={() => setSelectedRecipeId(null)}
            style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', color: '#766F64', fontSize: 13, padding: 0 }}
          >
            ← Cambiar receta
          </button>
        )}

        {(tab !== 'receta' || selectedRecipe) && (
          <>
            <pre
              style={{
                fontSize: 13.5,
                lineHeight: 1.5,
                color: '#2B2724',
                background: '#F1EBDF',
                borderRadius: 10,
                padding: 14,
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                maxHeight: 260,
                overflowY: 'auto',
              }}
            >
              {text}
            </pre>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => shareViaWhatsApp(text)}
                disabled={!canShare}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 8,
                  border: '1px solid #2B2724',
                  background: '#2B2724',
                  color: '#FAF8F4',
                  fontWeight: 600,
                  opacity: canShare ? 1 : 0.4,
                }}
              >
                WhatsApp
              </button>
              <button
                onClick={handleCopy}
                disabled={!canShare}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 8,
                  border: '1px solid #2B2724',
                  background: 'transparent',
                  color: '#2B2724',
                  fontWeight: 600,
                  opacity: canShare ? 1 : 0.4,
                }}
              >
                Copiar texto
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
