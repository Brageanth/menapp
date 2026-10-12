import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { mergePulledRows } from '../sync-pull';
import { supabase } from '../supabase-client';
import type { RecipeMigrationRecord } from '@/domain/recipe-migration';

function toRow(record: RecipeMigrationRecord) {
  return {
    id: record.id,
    recipe_id: record.recipeId,
    status: record.status,
    decision: record.decision,
    proposed_components: record.proposedComponents,
    note: record.note,
    reviewed_by_user: record.reviewedByUser,
    updated_at: record.updatedAt,
  };
}

function fromRow(row: Record<string, unknown>): RecipeMigrationRecord {
  return {
    id: row.id as string,
    recipeId: row.recipe_id as string,
    status: row.status as RecipeMigrationRecord['status'],
    decision: (row.decision as RecipeMigrationRecord['decision'] | null) ?? null,
    proposedComponents: (row.proposed_components as RecipeMigrationRecord['proposedComponents']) ?? [],
    note: (row.note as string) ?? '',
    reviewedByUser: Boolean(row.reviewed_by_user),
    updatedAt: row.updated_at as string,
  };
}

export const recipeMigrationRepo = {
  async list(): Promise<RecipeMigrationRecord[]> {
    return db.recipeMigrations.toArray();
  },

  async add(record: RecipeMigrationRecord): Promise<void> {
    await db.recipeMigrations.add(record);
    await enqueueWrite('recipe_migrations', 'insert', toRow(record));
  },

  async update(record: RecipeMigrationRecord): Promise<void> {
    await db.recipeMigrations.put(record);
    await enqueueWrite('recipe_migrations', 'update', toRow(record));
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('recipe_migrations').select('*');
    if (data) await mergePulledRows(db.recipeMigrations, data.map(fromRow), (r) => r.updatedAt);
  },
};
