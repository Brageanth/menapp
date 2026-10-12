import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { mergePulledRows } from '../sync-pull';
import { supabase } from '../supabase-client';
import type { SavedPlate } from '@/domain/saved-plate';

function toRow(plate: SavedPlate) {
  return {
    id: plate.id,
    name: plate.name,
    slot: plate.slot,
    entries: plate.entries,
    favorite: plate.favorite ?? null,
    status: plate.status,
    updated_at: plate.updatedAt,
  };
}

function fromRow(row: Record<string, unknown>): SavedPlate {
  return {
    id: row.id as string,
    name: row.name as string,
    slot: row.slot as SavedPlate['slot'],
    entries: row.entries as SavedPlate['entries'],
    favorite: (row.favorite as boolean | null) ?? undefined,
    status: row.status as SavedPlate['status'],
    updatedAt: row.updated_at as string,
  };
}

export const savedPlateRepo = {
  async list(): Promise<SavedPlate[]> {
    return db.savedPlates.toArray();
  },

  async add(plate: SavedPlate): Promise<void> {
    await db.savedPlates.add(plate);
    await enqueueWrite('saved_plates', 'insert', toRow(plate));
  },

  async update(plate: SavedPlate): Promise<void> {
    await db.savedPlates.put(plate);
    await enqueueWrite('saved_plates', 'update', toRow(plate));
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('saved_plates').select('*');
    if (data) await mergePulledRows(db.savedPlates, data.map(fromRow), (p) => p.updatedAt);
  },
};
