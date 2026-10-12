import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { mergePulledRows } from '../sync-pull';
import { supabase } from '../supabase-client';
import type { FlavorPair } from '@/domain/flavor-pair';

function toRow(pair: FlavorPair) {
  return {
    id: pair.id,
    component_a_id: pair.componentAId,
    component_b_id: pair.componentBId,
    relation: pair.relation,
    updated_at: pair.updatedAt,
  };
}

function fromRow(row: Record<string, unknown>): FlavorPair {
  return {
    id: row.id as string,
    componentAId: row.component_a_id as string,
    componentBId: row.component_b_id as string,
    relation: row.relation as FlavorPair['relation'],
    updatedAt: row.updated_at as string,
  };
}

export const flavorPairRepo = {
  async list(): Promise<FlavorPair[]> {
    return db.flavorPairs.toArray();
  },

  async add(pair: FlavorPair): Promise<void> {
    await db.flavorPairs.add(pair);
    await enqueueWrite('flavor_pairs', 'insert', toRow(pair));
  },

  async remove(id: string): Promise<void> {
    await db.flavorPairs.delete(id);
    await enqueueWrite('flavor_pairs', 'delete', { id });
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('flavor_pairs').select('*');
    if (data) await mergePulledRows(db.flavorPairs, data.map(fromRow), (p) => p.updatedAt);
  },
};
