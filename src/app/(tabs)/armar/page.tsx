'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import { MacroBars } from '@/components/macro-bars';
import { MealEntryRow } from '@/components/meal-entry-row';
import { componentRepo } from '@/data/repositories/component-repo';
import { assembledMealRepo } from '@/data/repositories/assembled-meal-repo';
import { mealTemplateRepo } from '@/data/repositories/meal-template-repo';
import { profileRepo } from '@/data/repositories/profile-repo';
import { savedPlateRepo } from '@/data/repositories/saved-plate-repo';
import { inventoryRepo } from '@/data/repositories/inventory-repo';
import { componentBatchRepo } from '@/data/repositories/component-batch-repo';
import { flavorPairRepo } from '@/data/repositories/flavor-pair-repo';
import { componentRatingRepo } from '@/data/repositories/component-rating-repo';
import { archiveComponent, createComponent, macrosForQuantity, roleLabel, type Component, type Macros, type RoleId } from '@/domain/component';
import type { InventoryItem } from '@/domain/inventory';
import type { ComponentBatch } from '@/domain/component-batch';
import type { FlavorPair } from '@/domain/flavor-pair';
import { applyRating, ratingScore, type ComponentRating } from '@/domain/component-rating';
import { recentlyUsedComponentIds, suggestComponentsForRole, type Suggestion } from '@/domain/suggestion';
import { rerollMeal } from '@/domain/meal-reroll';
import { generateWeekPlan } from '@/domain/week-plan';
import { completeMeal, groupEntriesByTemplate } from '@/domain/meal-compose';
import { sizeMeals, type MacroTarget } from '@/domain/meal-sizing';
import { createDefaultTemplate, updateTemplateSlots, type MealTemplate, type TemplateSlot } from '@/domain/meal-template';
import {
  copyMeal,
  createAssembledMeal,
  mealMacros,
  registerFreeMeal,
  removeEntry,
  setEntry,
  toggleLock,
  type AssembledMeal,
  type MealComponentEntry,
} from '@/domain/meal-assembly';
import { createSavedPlate, filterSavedPlates, applyPlateToMeal, type SavedPlate } from '@/domain/saved-plate';
import { SLOT_KCAL_WEIGHTS, SLOT_LABELS, type MealSlot } from '@/domain/meal-slot';
import { startOfWeek, toDateKey, todayDate, weekDates } from '@/domain/date';
import { DEFAULT_MACRO_GOAL } from '@/domain/macro-goal';
import type { Profile } from '@/domain/profile';

const ComponentPickerSheet = dynamic(() => import('@/components/component-picker-sheet').then((m) => m.ComponentPickerSheet));
const FreeMealSheet = dynamic(() => import('@/components/free-meal-sheet').then((m) => m.FreeMealSheet));
const TemplateEditSheet = dynamic(() => import('@/components/template-edit-sheet').then((m) => m.TemplateEditSheet));
const SuggestionSheet = dynamic(() => import('@/components/suggestion-sheet').then((m) => m.SuggestionSheet));
const GenerateWeekSheet = dynamic(() => import('@/components/generate-week-sheet').then((m) => m.GenerateWeekSheet));
const SavedPlateSheet = dynamic(() => import('@/components/saved-plate-sheet').then((m) => m.SavedPlateSheet));

const SLOTS: MealSlot[] = ['D', 'M', 'A', 'O', 'C'];


/** Lo que ya salió al rollear una comida (para no repetirlo) y las versiones anteriores (para volver atrás). */
interface RollState {
  tried: string[];
  history: MealComponentEntry[][];
}

function dateLabel(date: string): string {
  const today = todayDate();
  if (date === today) return 'Hoy';
  if (date === shiftDate(today, 1)) return 'Mañana';
  if (date === shiftDate(today, -1)) return 'Ayer';
  return new Date(date + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

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
  /** Sugerencias abiertas para un rol; con `replaceId` la elegida reemplaza a ese componente en vez de sumarse. */
  const [suggesting, setSuggesting] = useState<{ role: RoleId; replaceId?: string } | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [showDayMacros, setShowDayMacros] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [rolls, setRolls] = useState<Record<string, RollState>>({});
  const [rollNonce, setRollNonce] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
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

  const dayTarget = useMemo<MacroTarget | null>(
    () =>
      profile?.kcalTarget
        ? { kcal: profile.kcalTarget, protein: profile.proteinTarget, carbs: profile.carbsTarget, fat: profile.fatTarget }
        : null,
    [profile]
  );

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

  /** Macros de las otras comidas del día — cuentan como fijas al dimensionar esta. */
  function otherMealsMacros(): Macros {
    return meals
      .filter((m) => m.date === date && m.id !== meal.id)
      .reduce<Macros>(
        (sum, m) => {
          const mm = mealMacros(m, components);
          return { kcal: sum.kcal + mm.kcal, protein: sum.protein + mm.protein, carbs: sum.carbs + mm.carbs, fat: sum.fat + mm.fat };
        },
        { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      );
  }

  /** Dimensiona las porciones de esta comida para que el DÍA completo cumpla la meta. */
  function sizeForDay(entries: MealComponentEntry[]): MealComponentEntry[] {
    if (!dayTarget) return entries;
    return sizeMeals({ meals: [entries], components, target: dayTarget, fixed: otherMealsMacros() }).meals[0];
  }

  function handleAdjust() {
    if (!dayTarget) return;
    persist({ ...meal, entries: sizeForDay(meal.entries), updatedAt: new Date().toISOString() });
  }

  function handleQuantity(entry: MealComponentEntry, quantity: number) {
    persist(setEntry(meal, entry.componentId, quantity, entry.locked));
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

  const grouped = useMemo(() => groupEntriesByTemplate(template, meal.entries, components), [template, meal.entries, components]);

  function renderEntry(entry: MealComponentEntry, role?: RoleId) {
    const component = componentMap.get(entry.componentId);
    if (!component) return null;
    const swapRole = role ?? component.roles[0];
    return (
      <MealEntryRow
        key={entry.componentId}
        entry={entry}
        component={component}
        roleCaption={role ? roleLabel(role) : undefined}
        score={ratingScore(ratings, entry.componentId)}
        onQuantity={(q) => handleQuantity(entry, q)}
        onToggleLock={() => handleToggleLock(entry.componentId, !entry.locked)}
        onRate={(delta) => handleRate(entry.componentId, delta)}
        onSwap={() => setSuggesting({ role: swapRole, replaceId: entry.componentId })}
        onRemove={() => handleRemove(entry.componentId)}
      />
    );
  }

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
    if (!suggesting) return [];
    const remainingKcal = slotGoal?.kcalTarget ? slotGoal.kcalTarget - macros.kcal : null;
    return suggestComponentsForRole({
      role: suggesting.role,
      slot,
      candidates: components,
      inventory,
      batches,
      flavorPairs,
      ratings,
      recentlyUsedComponentIds: recentlyUsed,
      alreadyInMeal: meal.entries.filter((e) => e.componentId !== suggesting.replaceId).map((e) => e.componentId),
      remainingKcal,
      now: new Date(),
    });
  }, [suggesting, slot, components, inventory, batches, flavorPairs, ratings, recentlyUsed, meal.entries, slotGoal, macros.kcal]);

  function handlePickSuggestion(s: Suggestion) {
    const base = suggesting?.replaceId ? removeEntry(meal, suggesting.replaceId) : meal;
    persist(setEntry(base, s.component.id, s.component.portion.typical));
    setSuggesting(null);
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => (current === message ? null : current)), 3500);
  }

  /**
   * "Cambiar plato": vuelve a armar SOLO esta comida con las mismas reglas de Generar menú (plantilla,
   * macros, variedad, ratings, sabores). Lo que ya salió en tiradas anteriores queda al fondo hasta
   * agotar opciones; lo fijado se conserva; con "Solo con lo que tengo" prioriza despensa y lotes.
   */
  function handleReroll() {
    const state = rolls[meal.id] ?? { tried: [], history: [] };
    const hadEntries = meal.entries.length > 0;
    const currentFree = meal.entries.filter((e) => !e.locked).map((e) => e.componentId);
    const run = (tried: string[]) =>
      rerollMeal({
        template,
        slot,
        entries: meal.entries,
        components,
        inventory,
        batches,
        flavorPairs,
        ratings,
        recentlyUsedComponentIds: recentlyUsed,
        alreadyTriedIds: new Set(tried),
        slotKcalTarget: slotGoal?.kcalTarget ?? null,
        onlyInStock,
        now: new Date(),
      });

    let tried = [...new Set([...state.tried, ...currentFree])];
    let result = run(tried);
    // Ya pasaron todas las opciones: se empieza otra vuelta, esquivando solo lo que está puesto ahora.
    if (hadEntries && !result.changed) {
      tried = currentFree;
      result = run(tried);
    }
    if (result.entries.length === 0) {
      flash('No hay componentes para armar esta comida.');
      return;
    }
    if (hadEntries && !result.changed) {
      flash('No hay otra opción que cumpla las condiciones.');
      return;
    }

    const picked = result.entries.filter((e) => !e.locked).map((e) => e.componentId);
    setRolls((prev) => ({
      ...prev,
      [meal.id]: { tried: [...new Set([...tried, ...picked])], history: hadEntries ? [...state.history, meal.entries].slice(-10) : state.history },
    }));
    setRollNonce((n) => n + 1);
    persist({ ...meal, entries: sizeForDay(result.entries), updatedAt: new Date().toISOString() });
  }

  function handleUndoRoll() {
    const state = rolls[meal.id];
    const previous = state?.history[state.history.length - 1];
    if (!state || !previous) return;
    setRolls((prev) => ({ ...prev, [meal.id]: { ...state, history: state.history.slice(0, -1) } }));
    setRollNonce((n) => n + 1);
    persist({ ...meal, entries: previous, updatedAt: new Date().toISOString() });
  }

  async function handleRate(componentId: string, delta: 1 | -1) {
    const next = applyRating(ratings, componentId, delta);
    const updated = next.find((r) => r.componentId === componentId)!;
    await componentRatingRepo.put(updated);
    setRatings(next);

    if (delta === -1 && updated.score < 0) {
      await regenerateAfterDislike(componentId, next);
    }
  }

  /** 👎 archiva el componente (deja de sugerirse) y regenera, de hoy en adelante, los platos donde ya estaba puesto. */
  async function regenerateAfterDislike(componentId: string, updatedRatings: ComponentRating[]) {
    const disliked = components.find((c) => c.id === componentId);
    if (!disliked) return;

    const archived = archiveComponent(disliked);
    await componentRepo.update(archived);
    const nextComponents = components.map((c) => (c.id === componentId ? archived : c));
    setComponents(nextComponents);

    const today = todayDate();
    const affected = meals.filter(
      (m) => m.date >= today && !m.isFreeMeal && m.entries.some((e) => e.componentId === componentId)
    );

    for (const m of affected) {
      const mealTemplate = templates.find((t) => t.slot === m.slot) ?? createDefaultTemplate(`default-${m.slot}`, m.slot);
      const role = disliked.roles.find((r) => mealTemplate.slots.some((ts) => ts.role === r));
      const withoutDisliked = removeEntry(m, componentId);

      if (!role) {
        await assembledMealRepo.update(withoutDisliked);
        continue;
      }

      const otherEntries = withoutDisliked.entries;
      const macrosSoFar = otherEntries.reduce((sum, e) => {
        const c = nextComponents.find((comp) => comp.id === e.componentId);
        return c ? sum + macrosForQuantity(c, e.quantity).kcal : sum;
      }, 0);
      const slotKcalTarget = profile?.kcalTarget ? profile.kcalTarget * SLOT_KCAL_WEIGHTS[m.slot] : null;
      const remainingKcal = slotKcalTarget != null ? slotKcalTarget - macrosSoFar : null;
      const recentlyUsedForMeal = recentlyUsedComponentIds(meals, m.date, 3, m.id);

      const [replacement] = suggestComponentsForRole({
        role,
        slot: m.slot,
        candidates: nextComponents,
        inventory,
        batches,
        flavorPairs,
        ratings: updatedRatings,
        recentlyUsedComponentIds: recentlyUsedForMeal,
        alreadyInMeal: otherEntries.map((e) => e.componentId),
        remainingKcal,
        now: new Date(),
      });

      const nextMeal = replacement ? setEntry(withoutDisliked, replacement.component.id, replacement.component.portion.typical) : withoutDisliked;
      await assembledMealRepo.update(nextMeal);
    }

    refresh();
  }

  /** E1 (comida vacía) / E2 (completar lo que falta): un top-1 por cada rol vacío de la plantilla, y después dimensiona. */
  function handleCompleteAutomatically() {
    const entries = completeMeal({
      template,
      slot,
      entries: meal.entries,
      components,
      inventory,
      batches,
      flavorPairs,
      ratings,
      recentlyUsedComponentIds: recentlyUsed,
      slotKcalTarget: slotGoal?.kcalTarget ?? null,
      onlyRequired: false,
      now: new Date(),
    });
    if (entries.length === meal.entries.length) return;
    persist({ ...meal, entries, updatedAt: new Date().toISOString() });
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
        isCompleteDish: !!s.isCompleteDish,
        ...(s.shoppingName ? { shoppingName: s.shoppingName as string } : {}),
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
        dailyTarget: useGoal ? dayTarget : null,
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

  const rollState = rolls[meal.id];
  const canUndo = (rollState?.history.length ?? 0) > 0;
  const hasEntries = meal.entries.length > 0;
  const dayKcalRatio = dayTarget?.kcal ? Math.min(dayTotals.kcal / dayTarget.kcal, 1) : 0;

  const moreActions: SheetAction[] = [
    ...(dayTarget && hasEntries ? [{ label: 'Ajustar porciones a mi meta del día', hint: 'Recalcula las cantidades de esta comida', onClick: handleAdjust }] : []),
    ...(hasEntries ? [{ label: 'Completar con opcionales', hint: 'Suma los roles de la plantilla que faltan', onClick: handleCompleteAutomatically }] : []),
    { label: 'Agregar un componente', onClick: () => setPickerRole('open') },
    { label: 'Platos guardados', hint: 'Usar o guardar esta comida como plato', onClick: () => setShowPlates(true) },
    ...(hasEntries ? [{ label: 'Copiar a otro día', onClick: () => setShowCopy(true) }] : []),
    { label: 'Comí fuera / comida libre', onClick: () => setShowFreeMeal(true) },
    { label: `Editar plantilla de ${SLOT_LABELS[slot].toLowerCase()}`, onClick: () => setEditingTemplate(true) },
    { label: 'Lotes preparados', href: '/lotes' },
  ];

  return (
    <div style={{ position: 'relative', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '22px 24px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h1 style={{ fontSize: 28 }}>Armar</h1>
          <button
            className="press"
            onClick={() => setShowGenerateWeek(true)}
            style={{ padding: '9px 14px', borderRadius: 999, background: 'transparent', color: '#2B2724', fontWeight: 600, fontSize: 13, border: '1px solid #2B2724', minHeight: 40 }}
          >
            Generar semana
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button className="press" onClick={() => setDate(shiftDate(date, -1))} aria-label="Día anterior" style={navButtonStyle}>
            ‹
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#2B2724', textTransform: 'capitalize' }}>{dateLabel(date)}</span>
          <button className="press" onClick={() => setDate(shiftDate(date, 1))} aria-label="Día siguiente" style={navButtonStyle}>
            ›
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {SLOTS.map((s) => (
            <button
              key={s}
              className="press"
              onClick={() => setSlot(s)}
              style={{
                flexShrink: 0,
                padding: '9px 14px',
                borderRadius: 999,
                border: slot === s ? '1px solid #2B2724' : '1px solid #E3DED3',
                background: slot === s ? '#2B2724' : 'transparent',
                color: slot === s ? '#FAF8F4' : '#766F64',
                fontSize: 13,
                fontWeight: 600,
                minHeight: 40,
              }}
            >
              {SLOT_LABELS[s]}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowDayMacros((v) => !v)}
          aria-expanded={showDayMacros}
          style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'none', border: 'none', padding: 0, textAlign: 'left' }}
        >
          <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#766F64', fontVariantNumeric: 'tabular-nums' }}>
            <span>
              Día: {Math.round(dayTotals.kcal)}
              {dayTarget?.kcal ? ` / ${Math.round(dayTarget.kcal)}` : ''} kcal · {Math.round(dayTotals.protein)} g prot
            </span>
            <span>{showDayMacros ? 'Ocultar' : 'Detalle'}</span>
          </span>
          {dayTarget?.kcal && (
            <span style={{ height: 4, borderRadius: 2, background: '#E3DED3', overflow: 'hidden', display: 'block' }}>
              <span style={{ display: 'block', width: `${dayKcalRatio * 100}%`, height: '100%', background: '#3F7D4F', transition: 'width 200ms cubic-bezier(0.23, 1, 0.32, 1)' }} />
            </span>
          )}
        </button>
        {showDayMacros && <MacroBars title="Día completo" totals={dayTotals} target={dayTarget} />}
      </div>

      <div style={{ flex: 1, padding: '4px 24px 24px', display: 'flex', flexDirection: 'column' }}>
        {meal.isFreeMeal ? (
          <div style={{ border: '1px solid #E3DED3', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#766F64' }}>Comida libre</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#2B2724' }}>{meal.freeMealDescription}</span>
            <button onClick={() => persist(createAssembledMeal(meal.id, date, slot))} style={{ alignSelf: 'flex-start', fontSize: 13, color: '#A8412B', background: 'none', border: 'none', padding: '8px 0 0' }}>
              Quitar y armar con componentes
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 4 }}>
              <h2 style={{ fontSize: 22 }}>{SLOT_LABELS[slot]}</h2>
              {hasEntries && (
                <span style={{ fontSize: 12.5, color: '#766F64', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(macros.kcal)} kcal · {Math.round(macros.protein)} g prot · {Math.round(macros.carbs)} g carb · {Math.round(macros.fat)} g grasa
                </span>
              )}
            </div>

            {!hasEntries && grouped.groups.every((g) => g.entries.length === 0) && (
              <p style={{ fontSize: 14, color: '#766F64', padding: '18px 0' }}>Todavía no armaste esta comida. Tocá “Armar comida” y te propongo una con lo que tenés.</p>
            )}

            <div key={rollNonce} className={rollNonce > 0 ? 'roll-in' : undefined}>
              {grouped.groups.flatMap((group) =>
                group.entries.length > 0
                  ? group.entries.map((entry) => renderEntry(entry, group.role))
                  : hasEntries && group.required
                    ? [
                        <button
                          key={group.slotId}
                          className="press"
                          onClick={() => setSuggesting({ role: group.role })}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '14px 0', background: 'none', border: 'none', borderBottom: '1px dashed #E3DED3', minHeight: 56, textAlign: 'left' }}
                        >
                          <span style={{ fontSize: 15, color: '#A8412B', fontWeight: 600 }}>+ {roleLabel(group.role)}</span>
                          <span style={{ fontSize: 12.5, color: '#766F64' }}>falta</span>
                        </button>,
                      ]
                    : []
              )}
              {grouped.other.map((entry) => renderEntry(entry))}
            </div>
          </>
        )}
      </div>

      {!meal.isFreeMeal && (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: '#FAF8F4',
            borderTop: '1px solid #E3DED3',
            padding: '12px 24px calc(12px + env(safe-area-inset-bottom, 0px))',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div aria-live="polite" style={{ minHeight: notice ? undefined : 0, fontSize: 12.5, color: '#A8412B' }}>
            {notice}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <button
              className="press"
              onClick={() => setOnlyInStock((v) => !v)}
              aria-pressed={onlyInStock}
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 600,
                minHeight: 36,
                border: onlyInStock ? '1px solid #2B2724' : '1px solid #E3DED3',
                background: onlyInStock ? '#2B2724' : 'transparent',
                color: onlyInStock ? '#FAF8F4' : '#766F64',
              }}
            >
              {onlyInStock ? '✓ ' : ''}Solo con lo que tengo
            </button>
            {canUndo && (
              <button className="press" onClick={handleUndoRoll} style={{ fontSize: 13, color: '#766F64', background: 'none', border: 'none', padding: '8px 0', minHeight: 36 }}>
                ‹ Anterior
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="press"
              onClick={() => setShowMore(true)}
              aria-label="Más opciones"
              style={{ width: 52, borderRadius: 10, background: 'transparent', border: '1px solid #E3DED3', color: '#2B2724', fontSize: 20, lineHeight: 1 }}
            >
              ⋯
            </button>
            <button
              className="press"
              onClick={handleReroll}
              style={{ flex: 1, padding: 14, borderRadius: 10, background: '#2B2724', color: '#FAF8F4', fontWeight: 600, fontSize: 15, border: 'none', minHeight: 52 }}
            >
              {hasEntries ? 'Cambiar plato' : 'Armar comida'}
            </button>
          </div>
        </div>
      )}

      {showMore && <ActionSheet title={SLOT_LABELS[slot]} actions={moreActions} onClose={() => setShowMore(false)} />}
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
      {suggesting && <SuggestionSheet suggestions={suggestions} onPick={handlePickSuggestion} onClose={() => setSuggesting(null)} />}
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

const navButtonStyle: React.CSSProperties = { width: 44, height: 44, borderRadius: 999, border: '1px solid #E3DED3', background: 'transparent', color: '#2B2724', fontSize: 18 };
