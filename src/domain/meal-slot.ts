export type MealSlot = 'D' | 'M' | 'A' | 'O' | 'C';

/** Reparto de kcal diarias por slot. Suma 1. */
export const SLOT_KCAL_WEIGHTS: Record<MealSlot, number> = {
  D: 0.25,
  M: 0.1,
  A: 0.35,
  O: 0.1,
  C: 0.2,
};

export const SLOT_LABELS: Record<MealSlot, string> = {
  D: 'Desayuno',
  M: 'Media mañana',
  A: 'Almuerzo',
  O: 'Onces',
  C: 'Cena',
};

export const ALL_SLOTS: MealSlot[] = ['D', 'M', 'A', 'O', 'C'];
