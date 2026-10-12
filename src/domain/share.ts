import type { ShoppingCategory, ShoppingListItem } from './shopping-list';
import { CATEGORY_LABELS } from './shopping-list';

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
