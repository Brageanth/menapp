import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { mergePulledRows } from '../sync-pull';
import { supabase } from '../supabase-client';
import type { ComponentBatch } from '@/domain/component-batch';

function toRow(batch: ComponentBatch) {
  return {
    id: batch.id,
    component_id: batch.componentId,
    prepared_at: batch.preparedAt,
    total_portions: batch.totalPortions,
    remaining_portions: batch.remainingPortions,
    location: batch.location,
    expires_at: batch.expiresAt,
    status: batch.status,
    updated_at: batch.updatedAt,
  };
}

function fromRow(row: Record<string, unknown>): ComponentBatch {
  return {
    id: row.id as string,
    componentId: row.component_id as string,
    preparedAt: row.prepared_at as string,
    totalPortions: Number(row.total_portions),
    remainingPortions: Number(row.remaining_portions),
    location: row.location as string,
    expiresAt: (row.expires_at as string | null) ?? null,
    status: row.status as ComponentBatch['status'],
    updatedAt: row.updated_at as string,
  };
}

export const componentBatchRepo = {
  async list(): Promise<ComponentBatch[]> {
    return db.componentBatches.toArray();
  },

  async add(batch: ComponentBatch): Promise<void> {
    await db.componentBatches.add(batch);
    await enqueueWrite('component_batches', 'insert', toRow(batch));
  },

  async update(batch: ComponentBatch): Promise<void> {
    await db.componentBatches.put(batch);
    await enqueueWrite('component_batches', 'update', toRow(batch));
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('component_batches').select('*');
    if (data) await mergePulledRows(db.componentBatches, data.map(fromRow), (b) => b.updatedAt);
  },
};
