'use client';

import { useEffect } from 'react';
import { registerSyncListeners } from '@/data/sync-queue';

export default function HoyPage() {
  useEffect(() => {
    registerSyncListeners();
  }, []);

  return (
    <div style={{ padding: '26px 24px' }}>
      <h1 style={{ fontSize: 38 }}>Hoy</h1>
      <p style={{ fontSize: 13, color: '#766F64', marginTop: 8 }}>
        El menú del día se arma en F3. Esta pantalla ya lee y escribe offline.
      </p>
    </div>
  );
}
