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
  // attempt an immediate sync instead of waiting for the next 'online' event or page visit
  void flushQueue();
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
    } catch (err) {
      // network/server error: leave it queued, retry on next flush
      console.error('[sync] flushQueue failed on write', write.table, write.op, err);
      break;
    }
  }
}

let listenersRegistered = false;

export function registerSyncListeners() {
  if (typeof window === 'undefined' || listenersRegistered) return;
  listenersRegistered = true;
  window.addEventListener('online', () => void flushQueue());
  void flushQueue();
}
