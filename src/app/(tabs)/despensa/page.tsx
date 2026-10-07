'use client';

import { useEffect, useState } from 'react';
import { inventoryRepo } from '@/data/repositories/inventory-repo';
import type { InventoryItem } from '@/domain/inventory';

export default function DespensaPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);

  useEffect(() => {
    inventoryRepo.list().then(setItems);
  }, []);

  return (
    <div style={{ padding: '26px 24px' }}>
      <h1 style={{ fontSize: 32 }}>Despensa</h1>
      <p style={{ fontSize: 13, color: '#766F64', marginTop: 8 }}>
        {items.length} productos (CRUD completo llega en F1). Esta lista ya se lee desde IndexedDB.
      </p>
    </div>
  );
}
