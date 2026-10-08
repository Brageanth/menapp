'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { profileRepo } from '@/data/repositories/profile-repo';
import { menuRepo } from '@/data/repositories/menu-repo';
import { recipeRepo } from '@/data/repositories/recipe-repo';
import type { PersonLabel, Profile } from '@/domain/profile';
import { todayDate } from '@/domain/menu';
import { dailyNutritionForProfile, type DailyNutritionTotals } from '@/domain/recipe';

const PERSON_LABELS: Record<PersonLabel, string> = { yo: 'Yo', pareja: 'Pareja' };

/**
 * Umbral (en gramos) para considerar un macro "incumplido" y mostrarlo en accent+bold con
 * "faltan X g". Por debajo de esto (redondeos de porciones que van de 0.5 en 0.5, o un par de
 * gramos de diferencia) se muestra como cumplido en gris — evita ruido visual por diferencias
 * irrelevantes.
 */
const MACRO_GAP_THRESHOLD_G = 5;

type MacroKey = 'protein' | 'carbs' | 'fat';

const MACRO_LABELS: Record<MacroKey, string> = {
  protein: 'Proteína',
  carbs: 'Carbohidratos',
  fat: 'Grasas',
};

const EMPTY_NUTRITION: DailyNutritionTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0, hasData: false };

function emptyProfile(personLabel: PersonLabel): Profile {
  return {
    id: personLabel,
    personLabel,
    kcalTarget: null,
    proteinTarget: null,
    carbsTarget: null,
    fatTarget: null,
  };
}

function toDraft(profile: Profile): Record<'kcal' | 'protein' | 'carbs' | 'fat', string> {
  return {
    kcal: profile.kcalTarget?.toString() ?? '',
    protein: profile.proteinTarget?.toString() ?? '',
    carbs: profile.carbsTarget?.toString() ?? '',
    fat: profile.fatTarget?.toString() ?? '',
  };
}

function MacroBar({ label, actual, target }: { label: string; actual: number; target: number }) {
  const gap = target - actual;
  const short = gap > MACRO_GAP_THRESHOLD_G;
  const pct = target > 0 ? Math.min(100, Math.max(0, (actual / target) * 100)) : 0;

  return (
    <div style={{ padding: '7px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        <span style={{ color: short ? 'var(--accent)' : 'var(--muted)', fontWeight: short ? 700 : 400 }}>
          {short
            ? `${Math.round(actual)} de ${Math.round(target)} g, faltan ${Math.round(gap)} g`
            : `${Math.round(actual)} de ${Math.round(target)} g`}
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
        <div
          style={{
            height: 6,
            width: `${pct}%`,
            background: short ? 'var(--accent)' : 'var(--foreground)',
            borderRadius: 3,
          }}
        />
      </div>
    </div>
  );
}

export default function MetasPage() {
  const [person, setPerson] = useState<PersonLabel>('yo');
  const [showBoth, setShowBoth] = useState(true);
  const [profiles, setProfiles] = useState<Record<PersonLabel, Profile>>({
    yo: emptyProfile('yo'),
    pareja: emptyProfile('pareja'),
  });
  const [drafts, setDrafts] = useState<Record<PersonLabel, ReturnType<typeof toDraft>>>({
    yo: toDraft(emptyProfile('yo')),
    pareja: toDraft(emptyProfile('pareja')),
  });
  const [nutrition, setNutrition] = useState<Record<PersonLabel, DailyNutritionTotals>>({
    yo: EMPTY_NUTRITION,
    pareja: EMPTY_NUTRITION,
  });
  const [editing, setEditing] = useState<PersonLabel | null>(null);
  const [saved, setSaved] = useState(false);
  const [todayRecipeNames, setTodayRecipeNames] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Record<PersonLabel, string | null>>({ yo: null, pareja: null });
  const [suggestionError, setSuggestionError] = useState<Record<PersonLabel, string | null>>({ yo: null, pareja: null });
  const [suggestionLoading, setSuggestionLoading] = useState<PersonLabel | null>(null);

  const refresh = useCallback(async () => {
    const [profileList, menuDays, recipes] = await Promise.all([
      profileRepo.list(),
      menuRepo.list(),
      recipeRepo.list(),
    ]);

    const nextProfiles: Record<PersonLabel, Profile> = {
      yo: emptyProfile('yo'),
      pareja: emptyProfile('pareja'),
    };
    for (const p of profileList) {
      if (p.personLabel === 'yo' || p.personLabel === 'pareja') nextProfiles[p.personLabel] = p;
    }
    setProfiles(nextProfiles);
    setDrafts({ yo: toDraft(nextProfiles.yo), pareja: toDraft(nextProfiles.pareja) });

    const today = todayDate();
    const todaysMenu = menuDays.filter((d) => d.date === today);
    setNutrition({
      yo: dailyNutritionForProfile(todaysMenu, recipes, nextProfiles.yo),
      pareja: dailyNutritionForProfile(todaysMenu, recipes, nextProfiles.pareja),
    });

    const recipeMap = new Map(recipes.map((r) => [r.id, r.name]));
    setTodayRecipeNames(
      todaysMenu.map((d) => (d.recipeId ? recipeMap.get(d.recipeId) : null)).filter((n): n is string => !!n)
    );
  }, []);

  async function handleSuggest(p: PersonLabel, totals: DailyNutritionTotals) {
    const profile = profiles[p];
    const macros = (['protein', 'carbs', 'fat'] as MacroKey[])
      .map((key) => {
        const target = key === 'protein' ? profile.proteinTarget : key === 'carbs' ? profile.carbsTarget : profile.fatTarget;
        if (!target) return null;
        return { label: MACRO_LABELS[key], actual: totals[key], target };
      })
      .filter((m): m is { label: string; actual: number; target: number } => !!m);

    setSuggestionLoading(p);
    setSuggestionError((prev) => ({ ...prev, [p]: null }));
    try {
      const res = await fetch('/api/metas-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personLabel: PERSON_LABELS[p], kcalTarget: profile.kcalTarget, macros, recipeNames: todayRecipeNames }),
      });
      const data = (await res.json()) as { suggestion?: string; error?: string };
      if (!res.ok) {
        setSuggestionError((prev) => ({ ...prev, [p]: data.error ?? 'No se pudo generar una sugerencia.' }));
        return;
      }
      setSuggestions((prev) => ({ ...prev, [p]: data.suggestion ?? null }));
    } catch {
      setSuggestionError((prev) => ({ ...prev, [p]: 'No se pudo generar una sugerencia. Revisá tu conexión.' }));
    } finally {
      setSuggestionLoading(null);
    }
  }

  useEffect(() => {
    refresh().catch((err) => console.error('[metas] load failed', err));
  }, [refresh]);

  function updateDraft(field: keyof ReturnType<typeof toDraft>, value: string) {
    setSaved(false);
    setDrafts((prev) => ({ ...prev, [person]: { ...prev[person], [field]: value } }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const draft = drafts[person];
    const next: Profile = {
      ...profiles[person],
      id: person,
      personLabel: person,
      kcalTarget: draft.kcal ? Number(draft.kcal) : null,
      proteinTarget: draft.protein ? Number(draft.protein) : null,
      carbsTarget: draft.carbs ? Number(draft.carbs) : null,
      fatTarget: draft.fat ? Number(draft.fat) : null,
    };
    await profileRepo.update(next);
    setProfiles((prev) => ({ ...prev, [person]: next }));
    setSaved(true);
    setEditing(null);
    setSuggestions((prev) => ({ ...prev, [person]: null }));
  }

  const visiblePeople = useMemo<PersonLabel[]>(() => (showBoth ? ['yo', 'pareja'] : ['yo']), [showBoth]);
  const draft = drafts[person];

  return (
    <div style={{ padding: '26px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 32, fontFamily: 'var(--font-serif)' }}>Metas</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
            Metas nutricionales diarias, manuales. Se usan para escalar porciones en Receta y en la generación de
            menú.
          </p>
        </div>
        <Link href="/avisos" style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap', marginTop: 10 }}>
          Avisos →
        </Link>
      </div>

      <div style={{ display: 'flex', border: '1px solid var(--foreground)', borderRadius: 8, overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setShowBoth(true)}
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '13px 4px',
            fontSize: 12.5,
            fontWeight: 600,
            background: showBoth ? 'var(--foreground)' : 'transparent',
            color: showBoth ? 'var(--background)' : 'var(--foreground)',
            border: 'none',
          }}
        >
          Yo y mi pareja
        </button>
        <button
          type="button"
          onClick={() => {
            setShowBoth(false);
            setPerson('yo');
          }}
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '13px 4px',
            fontSize: 12.5,
            fontWeight: 600,
            background: !showBoth ? 'var(--foreground)' : 'transparent',
            color: !showBoth ? 'var(--background)' : 'var(--foreground)',
            border: 'none',
            borderLeft: '1px solid var(--foreground)',
          }}
        >
          Solo yo
        </button>
      </div>

      {visiblePeople.map((p) => {
        const profile = profiles[p];
        const totals = nutrition[p];
        const kcalTarget = profile.kcalTarget;

        return (
          <div key={p} style={{ borderTop: '1px solid var(--foreground)', paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 23 }}>{PERSON_LABELS[p]}</h2>
              <button
                type="button"
                onClick={() => {
                  setPerson(p);
                  setEditing(editing === p ? null : p);
                  setSaved(false);
                }}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'underline',
                  textUnderlineOffset: 4,
                  padding: '13px 4px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--foreground)',
                }}
              >
                {editing === p ? 'Cerrar' : 'Editar'}
              </button>
            </div>

            {kcalTarget ? (
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '6px 0' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--foreground)' }}>
                  {kcalTarget.toLocaleString('es')}
                </span>{' '}
                kcal al día. Lo que aporta el menú de hoy:
              </p>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '6px 0' }}>
                Sin meta de calorías configurada para {PERSON_LABELS[p].toLowerCase()}.
              </p>
            )}

            {editing !== p && saved && person === p && (
              <p style={{ fontSize: 13, color: 'var(--accent)', margin: '0 0 6px' }}>Metas guardadas.</p>
            )}

            {!totals.hasData ? (
              <p style={{ fontSize: 13, color: 'var(--muted)', padding: '7px 0' }}>
                Sin datos nutricionales para el menú de hoy.
              </p>
            ) : (
              (['protein', 'carbs', 'fat'] as MacroKey[]).map((key) => {
                const target =
                  key === 'protein' ? profile.proteinTarget : key === 'carbs' ? profile.carbsTarget : profile.fatTarget;
                if (!target) return null;
                return (
                  <MacroBar key={key} label={MACRO_LABELS[key]} actual={totals[key]} target={target} />
                );
              })
            )}

            {totals.hasData && (
              <div style={{ marginTop: 8 }}>
                {suggestions[p] ? (
                  <div
                    style={{
                      display: 'flex',
                      gap: 11,
                      alignItems: 'center',
                      padding: '11px 12px',
                      background: 'var(--accent-soft)',
                      borderRadius: 6,
                      fontSize: 13,
                      lineHeight: 1.35,
                    }}
                  >
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 5,
                        background: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: '#fff',
                        fontSize: 13,
                      }}
                    >
                      ✨
                    </span>
                    <span>
                      <b>Sugerencia:</b> {suggestions[p]}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSuggest(p, totals)}
                    disabled={suggestionLoading === p}
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: 'underline',
                      textUnderlineOffset: 4,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--foreground)',
                      padding: '4px 0',
                    }}
                  >
                    {suggestionLoading === p ? 'Pensando…' : 'Ver sugerencia'}
                  </button>
                )}
                {suggestionError[p] && (
                  <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>{suggestionError[p]}</p>
                )}
              </div>
            )}

            {editing === p && (
              <form
                onSubmit={handleSave}
                style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}
              >
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
                  Calorías (kcal/día)
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={draft.kcal}
                    onChange={(e) => updateDraft('kcal', e.target.value)}
                    placeholder="2000"
                    style={inputStyle}
                  />
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--muted)', flex: 1 }}>
                    Proteína (g)
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={draft.protein}
                      onChange={(e) => updateDraft('protein', e.target.value)}
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--muted)', flex: 1 }}>
                    Carbos (g)
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={draft.carbs}
                      onChange={(e) => updateDraft('carbs', e.target.value)}
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--muted)', flex: 1 }}>
                    Grasa (g)
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={draft.fat}
                      onChange={(e) => updateDraft('fat', e.target.value)}
                      style={inputStyle}
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    background: 'var(--foreground)',
                    color: 'var(--background)',
                    fontWeight: 600,
                    fontSize: 14.5,
                    border: 'none',
                  }}
                >
                  Guardar
                </button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  borderRadius: 8,
  border: '1px solid var(--foreground)',
  fontSize: 16,
  background: 'transparent',
  color: 'var(--foreground)',
  fontFamily: 'inherit',
};
