import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { supabase } from '../supabase-client';
import type { Receipt } from '@/domain/receipt';

/** Supabase columns are snake_case; local/domain objects are camelCase. */
function toRow(receipt: Receipt) {
  return {
    id: receipt.id,
    image_path: receipt.imagePath,
    status: receipt.status,
    items: receipt.items,
    created_at: receipt.createdAt,
    error: receipt.error ?? null,
  };
}

function fromRow(row: Record<string, unknown>): Receipt {
  return {
    id: row.id as string,
    imagePath: (row.image_path as string | null) ?? null,
    status: row.status as Receipt['status'],
    items: row.items as Receipt['items'],
    createdAt: row.created_at as string,
    error: (row.error as string | null) ?? undefined,
  };
}

export const receiptRepo = {
  async list(): Promise<Receipt[]> {
    return db.receipts.orderBy('createdAt').reverse().toArray();
  },

  async get(id: string): Promise<Receipt | undefined> {
    return db.receipts.get(id);
  },

  async add(receipt: Receipt): Promise<void> {
    await db.receipts.add(receipt);
    await enqueueWrite('receipts', 'insert', toRow(receipt));
  },

  async update(receipt: Receipt): Promise<void> {
    await db.receipts.put(receipt);
    await enqueueWrite('receipts', 'update', toRow(receipt));
  },

  async remove(id: string): Promise<void> {
    await db.receipts.delete(id);
    await enqueueWrite('receipts', 'delete', { id });
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('receipts').select('*');
    if (data) await db.receipts.bulkPut(data.map(fromRow));
  },

  /** Re-pushes every locally held receipt, bypassing the write queue — used for one-time disaster recovery. */
  async resyncAll(): Promise<void> {
    const all = await db.receipts.toArray();
    for (const receipt of all) await enqueueWrite('receipts', 'update', toRow(receipt));
  },
};
