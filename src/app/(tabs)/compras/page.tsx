'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { menuRepo } from '@/data/repositories/menu-repo';
import { recipeRepo } from '@/data/repositories/recipe-repo';
import { inventoryRepo } from '@/data/repositories/inventory-repo';
import { shoppingListRepo } from '@/data/repositories/shopping-list-repo';
import { startOfWeek, weekDates } from '@/domain/menu';
import { deriveShoppingList, reconcileShoppingList } from '@/domain/shopping-list';
import type { ShoppingCategory, ShoppingListItem } from '@/domain/shopping-list';

const CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  verduras: 'Verduras', proteinas: 'Proteínas', despensa: 'Despensa', otros: 'Otros',
};

export default function ComprasPage() {
  const [items, setItems] = useState<ShoppingListItem[]>([]);

  const refresh = useCallback(async () => {
    const weekStart = startOfWeek(new Date());
    const dates = weekDates(weekStart);
    const [menuDays, recipes, inventory, existing] = await Promise.all([
      menuRepo.list(), recipeRepo.list(), inventoryRepo.list(), shoppingListRepo.list(),
    ]);
    const weekMenuDays = menuDays.filter((m) => dates.includes(m.date));
    const derived = deriveShoppingList(weekMenuDays, recipes, inventory);
    const { toAdd, toUpdate, toRemove } = reconcileShoppingList(derived, existing);
    await Promise.all([
      ...toAdd.map((i) => shoppingListRepo.add(i)),
      ...toUpdate.map((i) => shoppingListRepo.update(i)),
      ...toRemove.map((id) => shoppingListRepo.remove(id)),
    ]);
    setItems(await shoppingListRepo.list());
  }, []);

  useEffect(() => { refresh().catch((err) => console.error('[compras] refresh failed', err)); }, [refresh]);

  async function togglePurchased(item: ShoppingListItem) {
    await shoppingListRepo.update({ ...item, purchased: !item.purchased, updatedAt: new Date().toISOString() });
    refresh();
  }

  const grouped = useMemo(() => {
    const groups: Record<ShoppingCategory, ShoppingListItem[]> = { verduras: [], proteinas: [], despensa: [], otros: [] };
    for (const item of items) groups[item.category].push(item);
    return groups;
  }, [items]);

  const pendingCount = items.filter((i) => !i.purchased).length;

  function buildShareText(): string {
    const lines: string[] = ['Lista de compras:'];
    for (const cat of Object.keys(CATEGORY_LABELS) as ShoppingCategory[]) {
      const list = grouped[cat].filter((i) => !i.purchased);
      if (!list.length) continue;
      lines.push(`\n${CATEGORY_LABELS[cat]}:`);
      for (const i of list) lines.push(`- ${i.name} (${i.quantity} ${i.unit})`);
    }
    return lines.join('\n');
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(buildShareText());
  }

  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildShareText())}`, '_blank');
  }

  return (
    <div style={{ padding: '26px 24px 100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 32 }}>Compras</h1>
        <span style={{ fontSize: 13, color: '#766F64' }}>{pendingCount} pendiente{pendingCount === 1 ? '' : 's'}</span>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={handleCopy} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #2B2724', background: 'transparent' }}>Copiar texto</button>
        <button onClick={handleWhatsApp} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #2B2724', background: 'transparent' }}>WhatsApp</button>
      </div>

      {(Object.keys(CATEGORY_LABELS) as ShoppingCategory[]).map((cat) => {
        if (!grouped[cat].length) return null;
        return (
          <div key={cat} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#766F64', marginBottom: 8 }}>{CATEGORY_LABELS[cat]}</div>
            {grouped[cat].map((item) => (
              <button
                key={item.id}
                onClick={() => togglePurchased(item)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '10px 0', borderBottom: '1px solid #E3DED3', border: 'none', background: 'transparent', opacity: item.purchased ? 0.45 : 1 }}
              >
                <span style={{ width: 18, height: 18, borderRadius: 4, border: '1px solid #2B2724', background: item.purchased ? '#2B2724' : 'transparent', flexShrink: 0 }} />
                <span style={{ flex: 1, textDecoration: item.purchased ? 'line-through' : 'none' }}>{item.name}</span>
                <span style={{ fontSize: 12.5, color: '#766F64' }}>{item.quantity} {item.unit}</span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
