'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/local-db';
import { registerSyncListeners } from '@/data/sync-queue';
import { registerPhotoQueueListener } from '@/data/photo-queue';
import { runResyncV1IfNeeded } from '@/data/resync';
import { pullAllFromRemote, registerPullListeners } from '@/data/pull-all';

/** Mounted once for the whole (tabs) layout — guarantees sync starts no matter which tab loads first. */
export function SyncManager() {
  const [repairing, setRepairing] = useState(true);
  const pendingCount = useLiveQuery(() => db.pendingWrites.count(), [], 0);

  useEffect(() => {
    registerSyncListeners();
    registerPhotoQueueListener();
    registerPullListeners();
    runResyncV1IfNeeded()
      .then(() => pullAllFromRemote())
      .catch((err) => console.error('[sync] initial pull failed', err))
      .finally(() => setRepairing(false));
  }, []);

  if (repairing) {
    return (
      <div role="status" aria-live="polite" style={{ padding: '6px 24px', fontSize: 12, color: '#766F64', background: '#F4EBD2', textAlign: 'center' }}>
        Sincronizando con la nube…
      </div>
    );
  }

  if (!pendingCount) return null;

  return (
    <div role="status" aria-live="polite" style={{ padding: '6px 24px', fontSize: 12, color: '#7D5A14', background: '#F4EBD2', textAlign: 'center' }}>
      {pendingCount} cambio{pendingCount === 1 ? '' : 's'} sin sincronizar — se sube{pendingCount === 1 ? '' : 'n'} solo{pendingCount === 1 ? '' : 's'} cuando haya señal.
    </div>
  );
}
