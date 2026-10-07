import type { Table } from 'dexie';
import { db } from './local-db';

/**
 * Merges rows pulled from Supabase into a local Dexie table.
 *
 * Conflict rule (last-write-wins): a pulled row only overwrites a local row when
 * `updatedAtOf` is given and the pulled row is strictly newer — otherwise the local
 * row wins (it's either newer or there's no way to tell, so we don't discard it blind).
 * Tables without a real `updatedAt` (profiles, receipts, recipe versions — effectively
 * append-only or single-writer) pass no `updatedAtOf` and just skip ids with a write
 * still queued; everything else gets overwritten by the remote row.
 *
 * Any id with a write still sitting in the local queue is skipped entirely: that write
 * hasn't reached Supabase yet, so the pulled row is stale by definition and applying it
 * would silently discard the user's own unsynced edit.
 *
 * Rows missing from the remote result (and with nothing pending) are deleted locally —
 * this is what propagates a delete made on the other device.
 */
export async function mergePulledRows<T extends { id: string }>(
  table: Table<T, string>,
  rows: T[],
  updatedAtOf?: (row: T) => string
): Promise<void> {
  const pendingIds = new Set(
    (await db.pendingWrites.toArray())
      .map((w) => (w.payload as { id?: string }).id)
      .filter((id): id is string => !!id)
  );
  const remoteIds = new Set(rows.map((r) => r.id));

  for (const row of rows) {
    if (pendingIds.has(row.id)) continue;
    if (!updatedAtOf) {
      await table.put(row);
      continue;
    }
    const local = await table.get(row.id);
    if (!local || new Date(updatedAtOf(row)).getTime() > new Date(updatedAtOf(local)).getTime()) {
      await table.put(row);
    }
  }

  const localIds = (await table.toCollection().primaryKeys()) as string[];
  const toDelete = localIds.filter((id) => !remoteIds.has(id) && !pendingIds.has(id));
  if (toDelete.length) await table.bulkDelete(toDelete);
}
