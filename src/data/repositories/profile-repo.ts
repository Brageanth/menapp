import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { mergePulledRows } from '../sync-pull';
import { supabase } from '../supabase-client';
import type { Profile } from '@/domain/profile';

/** Supabase columns are snake_case; local/domain objects are camelCase. */
function toRow(profile: Profile) {
  return {
    id: profile.id,
    person_label: profile.personLabel,
    kcal_target: profile.kcalTarget,
    protein_target: profile.proteinTarget,
    carbs_target: profile.carbsTarget,
    fat_target: profile.fatTarget,
  };
}

function fromRow(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    personLabel: row.person_label as Profile['personLabel'],
    kcalTarget: (row.kcal_target as number | null) ?? null,
    proteinTarget: (row.protein_target as number | null) ?? null,
    carbsTarget: (row.carbs_target as number | null) ?? null,
    fatTarget: (row.fat_target as number | null) ?? null,
  };
}

export const profileRepo = {
  async list(): Promise<Profile[]> {
    return db.profiles.toArray();
  },

  async update(profile: Profile): Promise<void> {
    await db.profiles.put(profile);
    await enqueueWrite('profiles', 'update', toRow(profile));
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('profiles').select('*');
    if (data) await mergePulledRows(db.profiles, data.map(fromRow));
  },

  /** Re-pushes every locally held profile, bypassing the write queue — used for one-time disaster recovery. */
  async resyncAll(): Promise<void> {
    const all = await db.profiles.toArray();
    for (const profile of all) await enqueueWrite('profiles', 'update', toRow(profile));
  },
};
