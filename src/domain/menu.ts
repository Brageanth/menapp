import type { MealSlot, Recipe } from './recipe';

export interface MenuDay {
  id: string;
  date: string;
  slot: MealSlot;
  recipeId: string | null;
  updatedAt: string;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function weekDates(start: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return toDateKey(d);
  });
}

export function todayDate(): string {
  return toDateKey(new Date());
}

export interface MenuGenerationRules {
  prioritizeLibrary: boolean;
  useExpiringFirst: boolean;
  varietyFocus: boolean;
  useGoals: boolean;
  includeMidMeals: boolean;
  mode: 'solo-despensa' | 'permitir-compras';
}

export interface GeneratedAssignment {
  date: string;
  slot: MealSlot;
  recipeId: string;
}

/** Descarta asignaciones que la IA haya inventado: recipeId fuera de la biblioteca, slot que no corresponde a esa receta, o fecha fuera de la semana pedida. */
export function sanitizeGeneratedMenu(
  assignments: GeneratedAssignment[],
  recipes: Recipe[],
  dates: string[]
): GeneratedAssignment[] {
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  const dateSet = new Set(dates);
  return assignments.filter((a) => {
    const recipe = recipeMap.get(a.recipeId);
    return !!recipe && recipe.slot === a.slot && dateSet.has(a.date);
  });
}

export interface VarietySummary {
  repeatedRecipeIds: string[];
  distinctProteins: number;
}

export function varietySummary(menuDays: MenuDay[], recipes: Recipe[]): VarietySummary {
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  const assignedIds = menuDays.map((m) => m.recipeId).filter((id): id is string => !!id);

  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const id of assignedIds) {
    if (seen.has(id)) repeated.add(id);
    seen.add(id);
  }

  const proteins = new Set<string>();
  for (const id of assignedIds) {
    const tag = recipeMap.get(id)?.proteinTag;
    if (tag) proteins.add(tag.trim().toLowerCase());
  }

  return { repeatedRecipeIds: [...repeated], distinctProteins: proteins.size };
}
