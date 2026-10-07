import type { MenuDay } from './menu';
import type { MealSlot, Recipe } from './recipe';
import { SLOT_LABELS } from './recipe';
import type { ShoppingCategory, ShoppingListItem } from './shopping-list';
import { CATEGORY_LABELS } from './shopping-list';

const SLOTS: MealSlot[] = ['D', 'M', 'A', 'O', 'C'];
export const SHARE_DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function dayLines(date: string, menuDays: MenuDay[], recipes: Recipe[]): string[] {
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  const lines: string[] = [];
  for (const slot of SLOTS) {
    const assignment = menuDays.find((m) => m.date === date && m.slot === slot);
    const recipe = assignment?.recipeId ? recipeMap.get(assignment.recipeId) : null;
    if (recipe) lines.push(`${SLOT_LABELS[slot]}: ${recipe.name}`);
  }
  return lines;
}

export function buildDayShareText(date: string, menuDays: MenuDay[], recipes: Recipe[]): string {
  const lines = dayLines(date, menuDays, recipes);
  return [`Menú del ${date}:`, ...(lines.length ? lines : ['Sin recetas asignadas.'])].join('\n');
}

export function buildWeekShareText(dates: string[], menuDays: MenuDay[], recipes: Recipe[]): string {
  const lines: string[] = ['Menú de la semana:'];
  let any = false;
  dates.forEach((date, i) => {
    const list = dayLines(date, menuDays, recipes);
    if (!list.length) return;
    any = true;
    lines.push(`\n${SHARE_DAY_LABELS[i]} ${date.slice(5)}:`);
    list.forEach((l) => lines.push(`- ${l}`));
  });
  if (!any) lines.push('Sin recetas asignadas.');
  return lines.join('\n');
}

export function buildRecipeShareText(recipe: Recipe): string {
  const lines = [`${recipe.name} (${SLOT_LABELS[recipe.slot]}, ${recipe.prepTimeMinutes} min)`, '', 'Ingredientes:'];
  for (const ing of recipe.ingredients) lines.push(`- ${ing.name}: ${ing.quantity} ${ing.unit}`);
  lines.push('', 'Pasos:');
  recipe.steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
  return lines.join('\n');
}

export function buildShoppingListShareText(items: ShoppingListItem[]): string {
  const lines: string[] = ['Lista de compras:'];
  let any = false;
  for (const cat of Object.keys(CATEGORY_LABELS) as ShoppingCategory[]) {
    const list = items.filter((i) => i.category === cat && !i.purchased);
    if (!list.length) continue;
    any = true;
    lines.push(`\n${CATEGORY_LABELS[cat]}:`);
    for (const i of list) lines.push(`- ${i.name} (${i.quantity} ${i.unit})`);
  }
  if (!any) lines.push('Nada pendiente.');
  return lines.join('\n');
}

export function shareViaWhatsApp(text: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}
