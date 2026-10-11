'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { componentRepo } from '@/data/repositories/component-repo';
import { assembledMealRepo } from '@/data/repositories/assembled-meal-repo';
import { mealTemplateRepo } from '@/data/repositories/meal-template-repo';
import { profileRepo } from '@/data/repositories/profile-repo';
import type { Component, Macros, RoleId } from '@/domain/component';
import { createDefaultTemplate, type MealTemplate } from '@/domain/meal-template';
import {
  adjustMealToFitKcal,
  createAssembledMeal,
  mealMacros,
  registerFreeMeal,
  removeEntry,
  setEntry,
  toggleLock,
  type AssembledMeal,
} from '@/domain/meal-assembly';
import { SLOT_KCAL_WEIGHTS, SLOT_LABELS, type MealSlot } from '@/domain/recipe';
import { toDateKey, todayDate } from '@/domain/menu';
import { DEFAULT_MACRO_GOAL, evaluateMacroStatus, type MacroStatus } from '@/domain/macro-goal';
import type { PersonLabel, Profile } from '@/domain/profile';

const ComponentPickerSheet = dynamic(() => import('@/components/component-picker-sheet').then((m) => m.ComponentPickerSheet));
const FreeMealSheet = dynamic(() => import('@/components/free-meal-sheet').then((m) => m.FreeMealSheet));

const SLOTS: MealSlot[] = ['D', 'M', 'A', 'O', 'C'];

const STATUS_COLOR: Record<MacroStatus, string> = { dentro: '#3F7D4F', cerca: '#B8862E', fuera: '#A8412B' };
const STATUS_LABEL: Record<MacroStatus, string> = { dentro: 'Dentro', cerca: 'Cerca', fuera: 'Fuera' };

function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export default function ArmarPage() {
  const [date, setDate] = useState(todayDate());
  const [slot, setSlot] = useState<MealSlot>('A');
  const [components, setComponents] = useState<Component[]>([]);
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [meals, setMeals] = useState<AssembledMeal[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pickerRole, setPickerRole] = useState<RoleId | null | 'open'>(null);
  const [showFreeMeal, setShowFreeMeal] = useState(false);

  const refresh = useCallback(async () => {
    const [allComponents, allTemplates, allMeals, profiles] = await Promise.all([
      componentRepo.list(),
      mealTemplateRepo.list(),
      assembledMealRepo.list(),
      profileRepo.list(),
    ]);
    setComponents(allComponents);
    setTemplates(allTemplates);
    setMeals(allMeals);
    setProfile(profiles.find((p: Profile & { personLabel: PersonLabel }) => p.personLabel === 'yo') ?? profiles[0] ?? null);
  }, []);

  useEffect(() => {
    let ignore = false;
    Promise.all([componentRepo.list(), mealTemplateRepo.list(), assembledMealRepo.list(), profileRepo.list()]).then(
      ([allComponents, allTemplates, allMeals, profiles]) => {
        if (ignore) return;
        setComponents(allComponents);
        setTemplates(allTemplates);
        setMeals(allMeals);
        setProfile(profiles.find((p: Profile) => p.personLabel === 'yo') ?? profiles[0] ?? null);
      }
    );
    return () => {
      ignore = true;
    };
  }, []);

  const template = useMemo(() => {
    const existing = templates.find((t) => t.slot === slot);
    return existing ?? createDefaultTemplate(`default-${slot}`, slot);
  }, [templates, slot]);

  const meal = useMemo(
    () => meals.find((m) => m.date === date && m.slot === slot) ?? createAssembledMeal(`${date}-${slot}`, date, slot),
    [meals, date, slot]
  );

  const macros = useMemo(() => mealMacros(meal, components), [meal, components]);

  const slotGoal = useMemo(() => {
    if (!profile?.kcalTarget) return null;
    const kcalTarget = profile.kcalTarget * SLOT_KCAL_WEIGHTS[slot];
    return {
      kcalTarget,
      proteinMinTarget: profile.proteinTarget ? profile.proteinTarget * SLOT_KCAL_WEIGHTS[slot] : null,
      carbsTarget: profile.carbsTarget ? profile.carbsTarget * SLOT_KCAL_WEIGHTS[slot] : null,
      fatTarget: profile.fatTarget ? profile.fatTarget * SLOT_KCAL_WEIGHTS[slot] : null,
      ...DEFAULT_MACRO_GOAL,
    };
  }, [profile, slot]);

  const status = useMemo(() => (slotGoal ? evaluateMacroStatus(macros, slotGoal) : null), [macros, slotGoal]);

  async function persist(next: AssembledMeal) {
    const exists = meals.some((m) => m.id === next.id);
    if (exists) await assembledMealRepo.update(next);
    else await assembledMealRepo.add(next);
    refresh();
  }

  function handlePick(component: Component, quantity: number) {
    persist(setEntry(meal, component.id, quantity));
    setPickerRole(null);
  }

  function handleRemove(componentId: string) {
    persist(removeEntry(meal, componentId));
  }

  function handleToggleLock(componentId: string, locked: boolean) {
    persist(toggleLock(meal, componentId, locked));
  }

  function handleAdjust() {
    if (!slotGoal?.kcalTarget) return;
    const result = adjustMealToFitKcal(meal, components, slotGoal.kcalTarget);
    persist(result.meal);
  }

  function handleFreeMeal(description: string, estimatedMacros: Macros) {
    persist(registerFreeMeal(meal.id, date, slot, description, estimatedMacros));
    setShowFreeMeal(false);
  }

  const componentMap = useMemo(() => new Map(components.map((c) => [c.id, c])), [components]);

  return (
    <div style={{ position: 'relative', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '26px 24px 12px', borderBottom: '1px solid #E3DED3', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h1 style={{ fontSize: 32 }}>Armar comida</h1>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => setDate(shiftDate(date, -1))} aria-label="Día anterior" style={navButtonStyle}>
            ‹
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#2B2724' }}>{date}</span>
          <button onClick={() => setDate(shiftDate(date, 1))} aria-label="Día siguiente" style={navButtonStyle}>
            ›
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {SLOTS.map((s) => (
            <button
              key={s}
              onClick={() => setSlot(s)}
              style={{
                flexShrink: 0,
                padding: '8px 14px',
                borderRadius: 999,
                border: slot === s ? '1px solid #2B2724' : '1px solid #E3DED3',
                background: slot === s ? '#2B2724' : 'transparent',
                color: slot === s ? '#FAF8F4' : '#766F64',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {SLOT_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {meal.isFreeMeal ? (
          <div style={{ border: '1px solid #E3DED3', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#766F64' }}>Comida libre</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#2B2724' }}>{meal.freeMealDescription}</span>
            <button onClick={() => persist(createAssembledMeal(meal.id, date, slot))} style={{ alignSelf: 'flex-start', fontSize: 12.5, color: '#A8412B', background: 'none', border: 'none', padding: 0, marginTop: 4 }}>
              Quitar y armar con componentes
            </button>
          </div>
        ) : (
          <>
            {template.slots.map((ts) => {
              const entries = meal.entries.filter((e) => componentMap.get(e.componentId)?.roles.includes(ts.role));
              return (
                <div key={ts.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <h3 style={{ fontSize: 14, color: '#766F64', textTransform: 'capitalize' }}>
                      {ts.role} {ts.required && entries.length === 0 && <span style={{ color: '#A8412B' }}> · falta</span>}
                    </h3>
                    <button onClick={() => setPickerRole(ts.role)} style={{ fontSize: 12.5, color: '#A8412B', background: 'none', border: 'none', padding: 0 }}>
                      + agregar
                    </button>
                  </div>
                  {entries.map((entry) => {
                    const component = componentMap.get(entry.componentId);
                    if (!component) return null;
                    return (
                      <div key={entry.componentId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #E3DED3' }}>
                        <span style={{ flex: 1, fontSize: 14.5, color: '#2B2724' }}>{component.name}</span>
                        <span style={{ fontSize: 13, color: '#766F64' }}>
                          {entry.quantity}
                          {component.unit}
                        </span>
                        <button
                          onClick={() => handleToggleLock(entry.componentId, !entry.locked)}
                          aria-label={entry.locked ? 'Quitar candado' : 'Poner candado'}
                          style={{ fontSize: 14, background: 'none', border: 'none', padding: 4, color: entry.locked ? '#A8412B' : '#766F64' }}
                        >
                          {entry.locked ? '🔒' : '🔓'}
                        </button>
                        <button onClick={() => handleRemove(entry.componentId)} aria-label="Quitar" style={{ fontSize: 14, background: 'none', border: 'none', padding: 4, color: '#766F64' }}>
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            <button onClick={() => setShowFreeMeal(true)} style={{ fontSize: 13, color: '#766F64', background: 'none', border: 'none', padding: '4px 0', textAlign: 'left' }}>
              Comí fuera / comida libre →
            </button>
          </>
        )}
      </div>

      {!meal.isFreeMeal && (
        <div style={{ borderTop: '1px solid #E3DED3', padding: '16px 24px calc(16px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: '#766F64' }}>
              {Math.round(macros.kcal)} kcal · {Math.round(macros.protein)}g prot · {Math.round(macros.carbs)}g carb · {Math.round(macros.fat)}g grasa
            </span>
            {status?.kcal && <span style={{ color: STATUS_COLOR[status.kcal], fontWeight: 600 }}>{STATUS_LABEL[status.kcal]}</span>}
          </div>
          {slotGoal?.kcalTarget && (
            <button onClick={handleAdjust} style={{ padding: 14, borderRadius: 10, background: '#2B2724', color: '#FAF8F4', fontWeight: 600, fontSize: 14, border: 'none' }}>
              Ajustar para calzar ({Math.round(slotGoal.kcalTarget)} kcal)
            </button>
          )}
        </div>
      )}

      {pickerRole && (
        <ComponentPickerSheet
          components={components}
          suggestedRole={pickerRole === 'open' ? undefined : pickerRole}
          onPick={handlePick}
          onClose={() => setPickerRole(null)}
        />
      )}
      {showFreeMeal && <FreeMealSheet onSave={handleFreeMeal} onClose={() => setShowFreeMeal(false)} />}
    </div>
  );
}

const navButtonStyle: React.CSSProperties = { width: 36, height: 36, borderRadius: 999, border: '1px solid #E3DED3', background: 'transparent', color: '#2B2724', fontSize: 18 };
