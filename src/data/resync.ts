import { db } from './local-db';
import { flushQueue } from './sync-queue';
import { inventoryRepo } from './repositories/inventory-repo';
import { recipeRepo } from './repositories/recipe-repo';
import { menuRepo } from './repositories/menu-repo';
import { shoppingListRepo } from './repositories/shopping-list-repo';
import { profileRepo } from './repositories/profile-repo';
import { receiptRepo } from './repositories/receipt-repo';

const RESYNC_V1_FLAG = 'menapp_resync_v1_done';

/**
 * One-time repair for the original sync bug: every write was being queued with
 * camelCase keys while Supabase's columns are snake_case, so every upsert failed
 * silently and nothing ever reached the remote DB. Clears whatever bad entries
 * are stuck in the write queue and re-pushes everything currently held locally,
 * using the corrected column mapping. Runs once per browser (flagged in localStorage).
 */
export async function runResyncV1IfNeeded(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(RESYNC_V1_FLAG)) return;

  try {
    await db.pendingWrites.clear();
    await Promise.all([
      inventoryRepo.resyncAll(),
      recipeRepo.resyncAll(),
      menuRepo.resyncAll(),
      shoppingListRepo.resyncAll(),
      profileRepo.resyncAll(),
      receiptRepo.resyncAll(),
    ]);
    await flushQueue();
    localStorage.setItem(RESYNC_V1_FLAG, new Date().toISOString());
  } catch (err) {
    console.error('[resync] one-time repair failed, will retry next load', err);
  }
}
