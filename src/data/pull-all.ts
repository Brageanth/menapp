import { inventoryRepo } from './repositories/inventory-repo';
import { recipeRepo } from './repositories/recipe-repo';
import { menuRepo } from './repositories/menu-repo';
import { shoppingListRepo } from './repositories/shopping-list-repo';
import { profileRepo } from './repositories/profile-repo';
import { receiptRepo } from './repositories/receipt-repo';
import { recipeVersionRepo } from './repositories/recipe-version-repo';
import { notificationSettingsRepo } from './repositories/notification-settings-repo';
import { supabase } from './supabase-client';

/**
 * Pulls every table from Supabase and merges it into Dexie (last-write-wins by updatedAt,
 * see sync-pull.ts). This is how the second device in the household finds out about changes
 * made on the first one — pushes alone (sync-queue.ts) never reach a device that didn't make them.
 * Call on app foreground (visibilitychange) and on reconnect ('online'), not on a timer: this is a
 * 2-person household, not a multi-user realtime app.
 *
 * Guarded on an active session: right after the tab resumes from background, supabase-js can still
 * be restoring the session from storage. A pull fired in that window goes out with no auth token,
 * RLS ("auth.uid() IS NOT NULL") silently filters every row to `[]`, and mergePulledRows reads that
 * as "deleted on the other device" — wiping locally-saved data (e.g. metas) that was never actually
 * removed. Skipping the pull until a session exists avoids treating "not logged in yet" as "empty".
 */
export async function pullAllFromRemote(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;

  await Promise.all([
    inventoryRepo.pullFromRemote(),
    recipeRepo.pullFromRemote(),
    menuRepo.pullFromRemote(),
    shoppingListRepo.pullFromRemote(),
    profileRepo.pullFromRemote(),
    receiptRepo.pullFromRemote(),
    recipeVersionRepo.pullFromRemote(),
    notificationSettingsRepo.pullFromRemote(),
  ]);
}

let listenersRegistered = false;

export function registerPullListeners() {
  if (typeof window === 'undefined' || listenersRegistered) return;
  listenersRegistered = true;
  window.addEventListener('online', () => void pullAllFromRemote());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void pullAllFromRemote();
  });
}
