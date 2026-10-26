import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { mergePulledRows } from '../sync-pull';
import { supabase } from '../supabase-client';
import { addToInventory, consolidateGroup, type InventoryItem } from '@/domain/inventory';

/** Supabase columns are snake_case; local/domain objects are camelCase. */
function toRow(item: InventoryItem) {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    // Solo viaja si se definió: el item sin peso por unidad no depende de que exista la columna.
    ...(item.unitWeight !== undefined && { unit_weight: item.unitWeight }),
    location: item.location,
    expires_at: item.expiresAt,
    updated_at: item.updatedAt,
  };
}

function fromRow(row: Record<string, unknown>): InventoryItem {
  return {
    id: row.id as string,
    name: row.name as string,
    quantity: Number(row.quantity),
    unit: row.unit as string,
    ...(row.unit_weight != null && { unitWeight: Number(row.unit_weight) }),
    location: row.location as InventoryItem['location'],
    expiresAt: (row.expires_at as string | null) ?? null,
    updatedAt: row.updated_at as string,
  };
}

export const inventoryRepo = {
  async list(): Promise<InventoryItem[]> {
    return db.inventoryItems.toArray();
  },

  async add(item: InventoryItem): Promise<void> {
    await db.inventoryItems.add(item);
    await enqueueWrite('inventory_items', 'insert', toRow(item));
  },

  /** Agrega un producto; si ya hay el mismo (aunque cambie plural, acento o unidad) le suma la cantidad. */
  async addOrMerge(incoming: InventoryItem): Promise<void> {
    const { item, merged } = addToInventory(await db.inventoryItems.toArray(), incoming);
    if (merged) await this.update(item);
    else await this.add(item);
  },

  /** Junta cada grupo de duplicados en una sola fila y borra las demás. Devuelve cuántas filas quitó. */
  async consolidate(groups: InventoryItem[][]): Promise<number> {
    let removed = 0;
    for (const group of groups) {
      await this.update(consolidateGroup(group));
      for (const extra of group.slice(1)) {
        await this.remove(extra.id);
        removed++;
      }
    }
    return removed;
  },

  async update(item: InventoryItem): Promise<void> {
    await db.inventoryItems.put(item);
    await enqueueWrite('inventory_items', 'update', toRow(item));
  },

  async remove(id: string): Promise<void> {
    await db.inventoryItems.delete(id);
    await enqueueWrite('inventory_items', 'delete', { id });
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('inventory_items').select('*');
    if (data) await mergePulledRows(db.inventoryItems, data.map(fromRow), (r) => r.updatedAt);
  },

  /** Re-pushes every locally held item, bypassing the write queue — used for one-time disaster recovery. */
  async resyncAll(): Promise<void> {
    const all = await db.inventoryItems.toArray();
    for (const item of all) await enqueueWrite('inventory_items', 'update', toRow(item));
  },
};
