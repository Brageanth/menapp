import { db, type PendingWrite } from './local-db';
import { supabase } from './supabase-client';

export async function enqueueWrite(
  table: PendingWrite['table'],
  op: PendingWrite['op'],
  payload: object
) {
  const write: PendingWrite = {
    id: crypto.randomUUID(),
    table,
    op,
    payload,
    createdAt: new Date().toISOString(),
  };
  await db.pendingWrites.add(write);
}

export async function flushQueue() {
  const pending = await db.pendingWrites.orderBy('createdAt').toArray();

  for (const write of pending) {
    try {
      if (write.op === 'insert' || write.op === 'update') {
        const { error } = await supabase.from(write.table).upsert(write.payload);
        if (error) throw error;
      } else if (write.op === 'delete') {
        const { id } = write.payload as { id: string };
        const { error } = await supabase.from(write.table).delete().eq('id', id);
        if (error) throw error;
      }
      await db.pendingWrites.delete(write.id);
    } catch {
      // network/server error: leave it queued, retry on next flush
      break;
    }
  }
}

export function registerSyncListeners() {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => void flushQueue());
  void flushQueue();
}
