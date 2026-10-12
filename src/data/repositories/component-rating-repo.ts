import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { mergePulledRows } from '../sync-pull';
import { supabase } from '../supabase-client';
import type { ComponentRating } from '@/domain/component-rating';

function toRow(rating: ComponentRating) {
  return {
    id: rating.id,
    component_id: rating.componentId,
    score: rating.score,
    updated_at: rating.updatedAt,
  };
}

function fromRow(row: Record<string, unknown>): ComponentRating {
  return {
    id: row.id as string,
    componentId: row.component_id as string,
    score: Number(row.score),
    updatedAt: row.updated_at as string,
  };
}

export const componentRatingRepo = {
  async list(): Promise<ComponentRating[]> {
    return db.componentRatings.toArray();
  },

  async put(rating: ComponentRating): Promise<void> {
    await db.componentRatings.put(rating);
    await enqueueWrite('component_ratings', 'update', toRow(rating));
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('component_ratings').select('*');
    if (data) await mergePulledRows(db.componentRatings, data.map(fromRow), (r) => r.updatedAt);
  },
};
