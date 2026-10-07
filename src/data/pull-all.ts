import { inventoryRepo } from './repositories/inventory-repo';
import { recipeRepo } from './repositories/recipe-repo';
import { menuRepo } from './repositories/menu-repo';
import { shoppingListRepo } from './repositories/shopping-list-repo';
import { profileRepo } from './repositories/profile-repo';
import { receiptRepo } from './repositories/receipt-repo';
import { recipeVersionRepo } from './repositories/recipe-version-repo';
import { notificationSettingsRepo } from './repositories/notification-settings-repo';

/**
 * Pulls every table from Supabase and merges it into Dexie (last-write-wins by updatedAt,
 * see sync-pull.ts). This is how the second device in the household finds out about changes
 * made on the first one — pushes alone (sync-queue.ts) never reach a device that didn't make them.
 * Call on app foreground (visibilitychange) and on reconnect ('online'), not on a timer: this is a
 * 2-person household, not a multi-user realtime app.
 */
export async function pullAllFromRemote(): Promise<void> {
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
