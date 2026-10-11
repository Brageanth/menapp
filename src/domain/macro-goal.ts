import type { Macros } from './component';

export type MacroStatus = 'dentro' | 'cerca' | 'fuera';

/**
 * D1: cada macro tiene su propio tipo de meta — kcal y carbs/fat son rango simétrico (±%), proteína
 * es piso con tope flexible (nunca penaliza pasarse, solo no llegar). Defaults del doc de producto.
 */
export interface MacroGoal {
  kcalTarget: number | null;
  kcalTolerancePct: number; // default 5
  proteinMinTarget: number | null;
  proteinCapOverPct: number; // default 15 — tope = min * (1 + capOverPct/100)
  carbsTarget: number | null;
  carbsTolerancePct: number; // default 10
  fatTarget: number | null;
  fatTolerancePct: number; // default 10
}

export const DEFAULT_MACRO_GOAL: Omit<MacroGoal, 'kcalTarget' | 'proteinMinTarget' | 'carbsTarget' | 'fatTarget'> = {
  kcalTolerancePct: 5,
  proteinCapOverPct: 15,
  carbsTolerancePct: 10,
  fatTolerancePct: 10,
};

interface Range {
  min: number;
  max: number;
}

function rangeFor(target: number, tolerancePct: number): Range {
  const delta = target * (tolerancePct / 100);
  return { min: target - delta, max: target + delta };
}

/** Estado de un valor contra su rango: dentro si cae en [min,max], cerca si está a <half del delta extra fuera, si no fuera. */
function statusForRange(value: number, range: Range): MacroStatus {
  if (value >= range.min && value <= range.max) return 'dentro';
  const span = range.max - range.min || 1;
  const nearMargin = span * 0.25;
  if (value >= range.min - nearMargin && value <= range.max + nearMargin) return 'cerca';
  return 'fuera';
}

function statusForFloor(value: number, min: number, capOverPct: number): MacroStatus {
  const cap = min * (1 + capOverPct / 100);
  if (value >= min && value <= cap) return 'dentro';
  if (value < min) {
    const nearMargin = min * 0.1;
    return value >= min - nearMargin ? 'cerca' : 'fuera';
  }
  // por encima del tope: cerca si no se aleja demasiado, nunca "fuera" por exceso de proteína
  const overMargin = cap * 0.15;
  return value <= cap + overMargin ? 'cerca' : 'cerca';
}

export interface MacroStatusReport {
  kcal: MacroStatus | null;
  protein: MacroStatus | null;
  carbs: MacroStatus | null;
  fat: MacroStatus | null;
}

/** D2: estado de un total de macros (día o semana) contra la meta configurada. */
export function evaluateMacroStatus(totals: Macros, goal: MacroGoal): MacroStatusReport {
  return {
    kcal: goal.kcalTarget != null ? statusForRange(totals.kcal, rangeFor(goal.kcalTarget, goal.kcalTolerancePct)) : null,
    protein: goal.proteinMinTarget != null ? statusForFloor(totals.protein, goal.proteinMinTarget, goal.proteinCapOverPct) : null,
    carbs: goal.carbsTarget != null ? statusForRange(totals.carbs, rangeFor(goal.carbsTarget, goal.carbsTolerancePct)) : null,
    fat: goal.fatTarget != null ? statusForRange(totals.fat, rangeFor(goal.fatTarget, goal.fatTolerancePct)) : null,
  };
}
