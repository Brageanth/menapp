'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { componentRepo } from '@/data/repositories/component-repo';
import { assembledMealRepo } from '@/data/repositories/assembled-meal-repo';
import { mealTemplateRepo } from '@/data/repositories/meal-template-repo';
import { profileRepo } from '@/data/repositories/profile-repo';
import { savedPlateRepo } from '@/data/repositories/saved-plate-repo';
import { inventoryRepo } from '@/data/repositories/inventory-repo';
import { componentBatchRepo } from '@/data/repositories/component-batch-repo';
import { flavorPairRepo } from '@/data/repositories/flavor-pair-repo';
import { componentRatingRepo } from '@/data/repositories/component-rating-repo';
import { createComponent, type Component, type Macros, type RoleId } from '@/domain/component';
import type { InventoryItem } from '@/domain/inventory';
import type { ComponentBatch } from '@/domain/component-batch';
import type { FlavorPair } from '@/domain/flavor-pair';
import { applyRating, type ComponentRating } from '@/domain/component-rating';
import { recentlyUsedComponentIds, suggestComponentsForRole, type Suggestion } from '@/domain/suggestion';
import { generateWeekPlan } from '@/domain/week-plan';
import { createDefaultTemplate, updateTemplateSlots, type MealTemplate, type TemplateSlot } from '@/domain/meal-template';
import {
  adjustMealToFitKcal,
  copyMeal,
  createAssembledMeal,
  mealMacros,
  registerFreeMeal,
  removeEntry,
  setEntry,
  toggleLock,
  type AssembledMeal,
} from '@/domain/meal-assembly';
import { createSavedPlate, filterSavedPlates, applyPlateToMeal, type SavedPlate } from '@/domain/saved-plate';
import { SLOT_KCAL_WEIGHTS, SLOT_LABELS, type MealSlot } from '@/domain/meal-slot';
import { startOfWeek, toDateKey, todayDate, weekDates } from '@/domain/date';
import { DEFAULT_MACRO_GOAL, evaluateMacroStatus, type MacroStatus } from '@/domain/macro-goal';
import { remainingTreatKcal, treatBudgetStatus, treatKcalSpent } from '@/domain/treat-budget';
import type { Profile } from '@/domain/profile';

const ComponentPickerSheet = dynamic(() => import('@/components/component-picker-sheet').then((m) => m.ComponentPickerSheet));
const FreeMealSheet = dynamic(() => import('@/components/free-meal-sheet').then((m) => m.FreeMealSheet));
const TemplateEditSheet = dynamic(() => import('@/components/template-edit-sheet').then((m) => m.TemplateEditSheet));
const SuggestionSheet = dynamic(() => import('@/components/suggestion-sheet').then((m) => m.SuggestionSheet));
const GenerateWeekSheet = dynamic(() => import('@/components/generate-week-sheet').then((m) => m.GenerateWeekSheet));
const SavedPlateSheet = dynamic(() => import('@/components/saved-plate-sheet').then((m) => m.SavedPlateSheet));

const SLOTS: MealSlot[] = ['D', 'M', 'A', 'O', 'C'];

const STATUS_COLOR: Record<MacroStatus, string> = { dentro: '#3F7D4F', cerca: '#B8862E', fuera: '#A8412B' };
const STATUS_LABEL: Record<MacroStatus, string> = { dentro: 'Dentro', cerca: 'Cerca', fuera: 'Fuera' };

function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export default function ArmarPage() {
  return (
    <Suspense fallback={null}>
      <ArmarPageContent />
    </Suspense>
  );
}

function ArmarPageContent() {
  const searchParams = useSearchParams();
  const [date, setDate] = useState(() => searchParams.get('date') ?? todayDate());
  const [slot, setSlot] = useState<MealSlot>(() => (searchParams.get('slot') as MealSlot | null) ?? 'A');
  const [components, setComponents] = useState<Component[]>([]);
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [meals, setMeals] = useState<AssembledMeal[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pickerRole, setPickerRole] = useState<RoleId | null | 'open'>(null);
  const [showFreeMeal, setShowFreeMeal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [savedPlates, setSavedPlates] = useState<SavedPlate[]>([]);
  const [showPlates, setShowPlates] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [copyTargetDate, setCopyTargetDate] = useState(todayDate());
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [batches, setBatches] = useState<ComponentBatch[]>([]);
  const [flavorPairs, setFlavorPairs] = useState<FlavorPair[]>([]);
  const [ratings, setRatings] = useState<ComponentRating[]>([]);
  const [suggestingRole, setSuggestingRole] = useState<RoleId | null>(null);
  const [showGenerateWeek, setShowGenerateWeek] = useState(false);
  const [generatingWeek, setGeneratingWeek] = useState(false);

  const loadAll = useCallback(() =>
    Promise.all([
      componentRepo.list(),
      mealTemplateRepo.list(),
      assembledMealRepo.list(),
      profileRepo.list(),
      savedPlateRepo.list(),
      inventoryRepo.list(),
      componentBatchRepo.list(),
      flavorPairRepo.list(),
      componentRatingRepo.list(),
    ]), []);

  const applyLoaded = useCallback(
    ([allComponents, allTemplates, allMeals, profiles, allPlates, allInventory, allBatches, allPairs, allRatings]: Awaited<ReturnType<typeof loadAll>>) => {
      setComponents(allComponents);
      setTemplates(allTemplates);
      setMeals(allMeals);
      setProfile(profiles.find((p: Profile) => p.personLabel === 'yo') ?? profiles[0] ?? null);
      setSavedPlates(allPlates);
      setInventory(allInventory);
      setBatches(allBatches);
      setFlavorPairs(allPairs);
      setRatings(allRatings);
    },
    []
  );

  const refresh = useCallback(async () => {
    applyLoaded(await loadAll());
  }, [loadAll, applyLoaded]);

  useEffect(() => {
    let ignore = false;
    loadAll().then((result) => {
      if (!ignore) applyLoaded(result);
    });
    return () => {
      ignore = true;
    };
  }, [loadAll, applyLoaded]);

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

  const dayTotals = useMemo(() => {
    const dayMeals = meals.filter((m) => m.date === date);
    return dayMeals.reduce<Macros>(
      (sum, m) => {
        const mm = mealMacros(m, components);
        return { kcal: sum.kcal + mm.kcal, protein: sum.protein + mm.protein, carbs: sum.carbs + mm.carbs, fat: sum.fat + mm.fat };
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [meals, date, components]);

  const dayGoal = useMemo(() => {
    if (!profile?.kcalTarget) return null;
    return {
      kcalTarget: profile.kcalTarget,
      proteinMinTarget: profile.proteinTarget,
      carbsTarget: profile.carbsTarget,
      fatTarget: profile.fatTarget,
      ...DEFAULT_MACRO_GOAL,
    };
  }, [profile]);

  const dayStatus = useMemo(() => (dayGoal ? evaluateMacroStatus(dayTotals, dayGoal) : null), [dayTotals, dayGoal]);

  const treatInfo = useMemo(() => {
    if (!profile?.treatBudgetKcal) return null;
    const budget = { period: profile.treatBudgetPeriod ?? 'weekly', kcalAmount: profile.treatBudgetKcal };
    const periodDates =
      budget.period === 'weekly' ? weekDates(startOfWeek(new Date(date + 'T00:00:00'))) : [date];
    const periodMeals = meals.filter((m) => periodDates.includes(m.date));
    const spent = treatKcalSpent(periodMeals, components);
    return { budget, spent, status: treatBudgetStatus(spent, budget), remaining: remainingTreatKcal(spent, budget) };
  }, [profile, meals, components, date]);

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

  async function handleSaveTemplate(slots: TemplateSlot[]) {
    const next = updateTemplateSlots(template, slots);
    const exists = templates.some((t) => t.id === next.id);
    if (exists) await mealTemplateRepo.update(next);
    else await mealTemplateRepo.add(next);
    setEditingTemplate(false);
    refresh();
  }

  const componentMap = useMemo(() => new Map(components.map((c) => [c.id, c])), [components]);

  async function handleSaveAsPlate(name: string) {
    const plate = createSavedPlate(crypto.randomUUID(), name, slot, meal.entries);
    await savedPlateRepo.add(plate);
    setShowPlates(false);
    refresh();
  }

  function handleUsePlate(plate: SavedPlate) {
    persist(applyPlateToMeal(meal, plate));
    setShowPlates(false);
  }

  async function handleCopyMeal() {
    const target = createAssembledMeal(`${copyTargetDate}-${slot}`, copyTargetDate, slot);
    const existing = meals.find((m) => m.id === target.id);
    const copied = copyMeal(meal, target.id, copyTargetDate, slot);
    if (existing) await assembledMealRepo.update(copied);
    else await assembledMealRepo.add(copied);
    setShowCopy(false);
    refresh();
  }

  const platesForSlot = useMemo(() => filterSavedPlates(savedPlates, { slot }), [savedPlates, slot]);

  const recentlyUsed = useMemo(() => recentlyUsedComponentIds(meals, date, 3, meal.id), [meals, date, meal.id]);

  const suggestions = useMemo(() => {
    if (!suggestingRole) return [];
    const remainingKcal = slotGoal?.kcalTarget ? slotGoal.kcalTarget - macros.kcal : null;
    return suggestComponentsForRole({
      role: suggestingRole,
      slot,
      candidates: components,
      inventory,
      batches,
      flavorPairs,
      ratings,
      recentlyUsedComponentIds: recentlyUsed,
      alreadyInMeal: meal.entries.map((e) => e.componentId),
      remainingKcal,
      now: new Date(),
    });
  }, [suggestingRole, slot, components, inventory, batches, flavorPairs, ratings, recentlyUsed, meal.entries, slotGoal, macros.kcal]);

  function handlePickSuggestion(s: Suggestion) {
    persist(setEntry(meal, s.component.id, s.component.portion.typical));
    setSuggestingRole(null);
  }

  async function handleRate(componentId: string, delta: 1 | -1) {
    const next = applyRating(ratings, componentId, delta);
    const updated = next.find((r) => r.componentId === componentId)!;
    await componentRatingRepo.put(updated);
    setRatings(next);
  }

  /** E1 (comida vacía) / E2 (completar lo que falta): un top-1 por cada rol vacío de la plantilla. */
  function handleCompleteAutomatically() {
    let next = meal;
    const remainingKcal = slotGoal?.kcalTarget ? slotGoal.kcalTarget - macros.kcal : null;
    for (const ts of template.slots) {
      const filled = next.entries.some((e) => componentMap.get(e.componentId)?.roles.includes(ts.role));
      if (filled) continue;
      const top = suggestComponentsForRole({
        role: ts.role,
        slot,
        candidates: components,
        inventory,
        batches,
        flavorPairs,
        ratings,
        recentlyUsedComponentIds: recentlyUsed,
        alreadyInMeal: next.entries.map((e) => e.componentId),
        remainingKcal,
        now: new Date(),
      })[0];
      if (top) next = setEntry(next, top.component.id, top.component.portion.typical);
    }
    if (next !== meal) persist(next);
  }

  /** Mínimo de candidatos activos por (rol, comida) antes de generar — evita que un solo invento se repita toda la semana. */
  const MIN_CANDIDATES_PER_ROLE = 3;

  /** Crea con IA un componente básico para un rol, con contexto de la comida — evita que "pollo" sirva para todo. */
  async function fillMissingRole(role: RoleId, slot: MealSlot, existingNames: string[]): Promise<Component | null> {
    try {
      const res = await fetch('/api/suggest-component', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, slot, existingNames }),
      });
      if (!res.ok) return null;
      const s = await res.json();
      const input = {
        name: s.name,
        roles: [role],
        typicalSlots: [slot],
        origin: 'simple' as const,
        unit: s.unit,
        portion: { typical: s.portionTypical, min: s.portionMin, max: s.portionMax, step: s.portionStep },
        weightState: 'cocido' as const,
        macrosBasis: s.macrosBasis,
        macros: s.macros,
        isTreat: false,
      };
      const created = createComponent(crypto.randomUUID(), input);
      await componentRepo.add(created);
      return created;
    } catch {
      return null;
    }
  }

  async function handleGenerateWeek(useGoal: boolean) {
    setGeneratingWeek(true);
    try {
      const weekStart = startOfWeek(new Date(date + 'T00:00:00'));
      const dates = weekDates(weekStart);

      let pool = components;
      const roleSlotPairs: { role: RoleId; slot: MealSlot }[] = [];
      for (const slot of SLOTS) {
        const template = templates.find((t) => t.slot === slot) ?? createDefaultTemplate(`default-${slot}`, slot);
        for (const ts of template.slots) if (ts.required) roleSlotPairs.push({ role: ts.role, slot });
      }
      const countFor = (role: RoleId, slot: MealSlot) =>
        pool.filter((c) => c.status === 'active' && c.roles.includes(role) && (!c.typicalSlots || c.typicalSlots.includes(slot))).length;
      for (const { role, slot } of roleSlotPairs) {
        let count = countFor(role, slot);
        while (count < MIN_CANDIDATES_PER_ROLE) {
          const created = await fillMissingRole(role, slot, pool.map((c) => c.name));
          if (!created) break;
          pool = [...pool, created];
          count = countFor(role, slot);
        }
      }
      if (pool !== components) setComponents(pool);

      const plan = generateWeekPlan({
        dates,
        slots: SLOTS,
        templates,
        components: pool,
        inventory,
        batches,
        flavorPairs,
        ratings,
        existingMeals: meals.filter((m) => !dates.includes(m.date)),
        dailyKcalTarget: useGoal ? profile?.kcalTarget ?? null : null,
        varietyWindowDays: 3,
        now: new Date(),
      });
      await Promise.all(
        plan.map((p) => {
          const id = `${p.date}-${p.slot}`;
          const existing = meals.find((m) => m.id === id);
          const next: AssembledMeal = { id, date: p.date, slot: p.slot, entries: p.entries, updatedAt: new Date().toISOString() };
          return existing ? assembledMealRepo.update(next) : assembledMealRepo.add(next);
        })
      );
      setShowGenerateWeek(false);
      refresh();
    } finally {
      setGeneratingWeek(false);
    }
  }

  return (
    <div style={{ position: 'relative', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '26px 24px 12px', borderBottom: '1px solid #E3DED3', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 32 }}>Armar comida</h1>
          <Link href="/lotes" style={{ fontSize: 12.5, color: '#766F64' }}>
            Lotes →
          </Link>
        </div>

        <button
          onClick={() => setShowGenerateWeek(true)}
          style={{ padding: 12, borderRadius: 10, background: '#2B2724', color: '#FAF8F4', fontWeight: 600, fontSize: 13.5, border: 'none' }}
        >
          Generar menú (semana)
        </button>

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
        {dayGoal && (
          <div style={{ border: '1px solid #E3DED3', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#766F64' }}>Día completo</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 14, color: '#2B2724' }}>
                {Math.round(dayTotals.kcal)} / {Math.round(dayGoal.kcalTarget ?? 0)} kcal · {Math.round(dayTotals.protein)}g prot
              </span>
              {dayStatus?.kcal && <span style={{ color: STATUS_COLOR[dayStatus.kcal], fontWeight: 600, fontSize: 13 }}>{STATUS_LABEL[dayStatus.kcal]}</span>}
            </div>
          </div>
        )}
        {treatInfo && (
          <div style={{ border: '1px solid #E3DED3', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#766F64' }}>Presupuesto de gustos ({treatInfo.budget.period === 'weekly' ? 'semanal' : 'diario'})</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 14, color: '#2B2724' }}>
                {Math.round(treatInfo.spent)} de {Math.round(treatInfo.budget.kcalAmount)} kcal usadas · quedan {Math.round(treatInfo.remaining)}
              </span>
              <span style={{ color: STATUS_COLOR[treatInfo.status], fontWeight: 600, fontSize: 13 }}>{STATUS_LABEL[treatInfo.status]}</span>
            </div>
          </div>
        )}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <button onClick={handleCompleteAutomatically} style={{ fontSize: 13, color: '#2B2724', fontWeight: 600, background: 'none', border: 'none', padding: 0 }}>
                Completar automáticamente
              </button>
              <button onClick={() => setEditingTemplate(true)} style={{ fontSize: 12.5, color: '#766F64', background: 'none', border: 'none', padding: 0 }}>
                Editar plantilla
              </button>
            </div>
            {template.slots.map((ts) => {
              const entries = meal.entries.filter((e) => componentMap.get(e.componentId)?.roles.includes(ts.role));
              return (
                <div key={ts.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <h3 style={{ fontSize: 14, color: '#766F64', textTransform: 'capitalize' }}>
                      {ts.role} {ts.required && entries.length === 0 && <span style={{ color: '#A8412B' }}> · falta</span>}
                    </h3>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => setSuggestingRole(ts.role)} style={{ fontSize: 12.5, color: '#2B2724', background: 'none', border: 'none', padding: 0 }}>
                        sugerir
                      </button>
                      <button onClick={() => setPickerRole(ts.role)} style={{ fontSize: 12.5, color: '#A8412B', background: 'none', border: 'none', padding: 0 }}>
                        + agregar
                      </button>
                    </div>
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
                        <button onClick={() => handleRate(entry.componentId, 1)} aria-label="Me gustó" style={{ fontSize: 13, background: 'none', border: 'none', padding: 4 }}>
                          👍
                        </button>
                        <button onClick={() => handleRate(entry.componentId, -1)} aria-label="No tanto" style={{ fontSize: 13, background: 'none', border: 'none', padding: 4 }}>
                          👎
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              <button onClick={() => setShowPlates(true)} style={{ fontSize: 13, color: '#766F64', background: 'none', border: 'none', padding: '4px 0', textAlign: 'left' }}>
                Platos guardados →
              </button>
              {meal.entries.length > 0 && (
                <button onClick={() => setShowCopy(true)} style={{ fontSize: 13, color: '#766F64', background: 'none', border: 'none', padding: '4px 0', textAlign: 'left' }}>
                  Copiar a otro día →
                </button>
              )}
              <button onClick={() => setShowFreeMeal(true)} style={{ fontSize: 13, color: '#766F64', background: 'none', border: 'none', padding: '4px 0', textAlign: 'left' }}>
                Comí fuera / comida libre →
              </button>
            </div>
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
      {editingTemplate && <TemplateEditSheet template={template} onSave={handleSaveTemplate} onClose={() => setEditingTemplate(false)} />}
      {suggestingRole && <SuggestionSheet suggestions={suggestions} onPick={handlePickSuggestion} onClose={() => setSuggestingRole(null)} />}
      {showGenerateWeek && (
        <GenerateWeekSheet hasGoal={!!profile?.kcalTarget} onGenerate={handleGenerateWeek} onClose={() => setShowGenerateWeek(false)} />
      )}
      {generatingWeek && (
        <div style={{ position: 'fixed', inset: 0, height: '100dvh', background: 'rgba(43,39,36,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, color: '#FAF8F4', fontSize: 14, fontWeight: 600 }}>
          Generando la semana…
        </div>
      )}
      {showPlates && (
        <SavedPlateSheet plates={platesForSlot} onPick={handleUsePlate} onSaveCurrentAsNew={handleSaveAsPlate} onClose={() => setShowPlates(false)} />
      )}
      {showCopy && (
        <div style={{ position: 'fixed', inset: 0, height: '100dvh', background: 'rgba(43,39,36,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }} onClick={() => setShowCopy(false)}>
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', background: '#FAF8F4', borderRadius: '16px 16px 0 0', padding: '24px 24px calc(24px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <h2 style={{ fontSize: 22 }}>Copiar a otro día</h2>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#766F64' }}>
              Fecha destino
              <input
                type="date"
                value={copyTargetDate}
                onChange={(e) => setCopyTargetDate(e.target.value)}
                style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid #2B2724', fontSize: 15, background: 'transparent', color: '#2B2724', fontFamily: 'inherit' }}
              />
            </label>
            <button onClick={handleCopyMeal} style={{ padding: 14, borderRadius: 10, background: '#2B2724', color: '#FAF8F4', fontWeight: 600, fontSize: 14.5, border: 'none' }}>
              Copiar {SLOT_LABELS[slot]} a {copyTargetDate}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const navButtonStyle: React.CSSProperties = { width: 36, height: 36, borderRadius: 999, border: '1px solid #E3DED3', background: 'transparent', color: '#2B2724', fontSize: 18 };
