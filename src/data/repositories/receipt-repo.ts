import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import type { Receipt } from '@/domain/receipt';

export const receiptRepo = {
  async list(): Promise<Receipt[]> {
    return db.receipts.orderBy('createdAt').reverse().toArray();
  },

  async get(id: string): Promise<Receipt | undefined> {
    return db.receipts.get(id);
  },

  async add(receipt: Receipt): Promise<void> {
    await db.receipts.add(receipt);
    await enqueueWrite('receipts', 'insert', receipt);
  },

  async update(receipt: Receipt): Promise<void> {
    await db.receipts.put(receipt);
    await enqueueWrite('receipts', 'update', receipt);
  },

  async remove(id: string): Promise<void> {
    await db.receipts.delete(id);
    await enqueueWrite('receipts', 'delete', { id });
  },
};
