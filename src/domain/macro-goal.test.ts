import { describe, expect, it } from 'vitest';
import { DEFAULT_MACRO_GOAL, evaluateMacroStatus, type MacroGoal } from './macro-goal';

function goal(overrides: Partial<MacroGoal> = {}): MacroGoal {
  return {
    kcalTarget: 2000,
    proteinMinTarget: 120,
    carbsTarget: 200,
    fatTarget: 60,
    ...DEFAULT_MACRO_GOAL,
    ...overrides,
  };
}

describe('evaluateMacroStatus — kcal (rango ±5%)', () => {
  it('dentro cuando está en el rango', () => {
    expect(evaluateMacroStatus({ kcal: 2000, protein: 0, carbs: 0, fat: 0 }, goal()).kcal).toBe('dentro');
  });

  it('cerca justo fuera del rango', () => {
    // rango 1900-2100, margen cerca = 50 (25% de span de 200) → hasta 2150
    expect(evaluateMacroStatus({ kcal: 2120, protein: 0, carbs: 0, fat: 0 }, goal()).kcal).toBe('cerca');
  });

  it('fuera lejos del rango', () => {
    expect(evaluateMacroStatus({ kcal: 3000, protein: 0, carbs: 0, fat: 0 }, goal()).kcal).toBe('fuera');
  });

  it('null si no hay meta configurada', () => {
    expect(evaluateMacroStatus({ kcal: 2000, protein: 0, carbs: 0, fat: 0 }, goal({ kcalTarget: null })).kcal).toBeNull();
  });
});

describe('evaluateMacroStatus — proteína (piso con tope flexible)', () => {
  it('dentro al llegar exacto al piso', () => {
    expect(evaluateMacroStatus({ kcal: 0, protein: 120, carbs: 0, fat: 0 }, goal()).protein).toBe('dentro');
  });

  it('dentro hasta el tope (+15%)', () => {
    expect(evaluateMacroStatus({ kcal: 0, protein: 138, carbs: 0, fat: 0 }, goal()).protein).toBe('dentro');
  });

  it('nunca "fuera" por pasarse de proteína', () => {
    expect(evaluateMacroStatus({ kcal: 0, protein: 300, carbs: 0, fat: 0 }, goal()).protein).not.toBe('fuera');
  });

  it('fuera si se queda muy por debajo del piso', () => {
    expect(evaluateMacroStatus({ kcal: 0, protein: 80, carbs: 0, fat: 0 }, goal()).protein).toBe('fuera');
  });

  it('cerca si está apenas debajo del piso', () => {
    expect(evaluateMacroStatus({ kcal: 0, protein: 115, carbs: 0, fat: 0 }, goal()).protein).toBe('cerca');
  });
});

describe('evaluateMacroStatus — carbs/fat (rango ±10%)', () => {
  it('dentro dentro del rango de carbs', () => {
    expect(evaluateMacroStatus({ kcal: 0, protein: 0, carbs: 210, fat: 0 }, goal()).carbs).toBe('dentro');
  });

  it('dentro dentro del rango de fat', () => {
    expect(evaluateMacroStatus({ kcal: 0, protein: 0, carbs: 0, fat: 55 }, goal()).fat).toBe('dentro');
  });
});
