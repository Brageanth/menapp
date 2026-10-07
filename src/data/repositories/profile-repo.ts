import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { supabase } from '../supabase-client';
import type { Profile } from '@/domain/profile';

export const profileRepo = {
  async list(): Promise<Profile[]> {
    return db.profiles.toArray();
  },

  async update(profile: Profile): Promise<void> {
    await db.profiles.put(profile);
    await enqueueWrite('profiles', 'update', profile);
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('profiles').select('*');
    if (data) await db.profiles.bulkPut(data as Profile[]);
  },
};
