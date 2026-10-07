'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { inventoryRepo } from '@/data/repositories/inventory-repo';
import {
  filterByQuery,
  isExpiringSoon,
  sortByExpiry,
  type InventoryItem,
} from '@/domain/inventory';
import { InventoryItemRow } from '@/components/inventory-item-row';
import { InventoryFormSheet, type InventoryFormValues } from '@/components/inventory-form-sheet';

type Tab = 'todo' | 'nevera' | 'alacena' | 'vencer';

const TABS: { id: Tab; label: string }[] = [
  { id: 'todo', label: 'Todo' },
  { id: 'nevera', label: 'Nevera' },
  { id: 'alacena', label: 'Alacena' },
  { id: 'vencer', label: 'Por vencer' },
];

export default function DespensaPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [now, setNow] = useState<Date | null>(null);
  const [tab, setTab] = useState<Tab>('todo');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<InventoryItem | 'new' | null>(null);

  const refresh = useCallback(async () => {
    const all = await inventoryRepo.list();
    setItems(all);
  }, []);

  useEffect(() => {
    let ignore = false;
    inventoryRepo
      .list()
      .then((all) => {
        if (!ignore) {
          setItems(all);
          setNow(new Date());
        }
      })
      .catch((err) => console.error('[despensa] list failed', err));
    return () => {
      ignore = true;
    };
  }, []);

  const expiringSoon = useMemo(
    () => (now ? sortByExpiry(items.filter((i) => isExpiringSoon(i, now)), now) : []),
    [items, now]
  );
  const expiringSoonIds = useMemo(() => new Set(expiringSoon.map((i) => i.id)), [expiringSoon]);

  const searched = useMemo(() => filterByQuery(items, query), [items, query]);
  const searchedIds = useMemo(() => new Set(searched.map((i) => i.id)), [searched]);

  const nevera = useMemo(
    () =>
      now
        ? sortByExpiry(items.filter((i) => i.location === 'nevera' && !expiringSoonIds.has(i.id) && searchedIds.has(i.id)), now)
        : [],
    [items, expiringSoonIds, searchedIds, now]
  );
  const alacena = useMemo(
    () =>
      now
        ? sortByExpiry(items.filter((i) => i.location === 'alacena' && !expiringSoonIds.has(i.id) && searchedIds.has(i.id)), now)
        : [],
    [items, expiringSoonIds, searchedIds, now]
  );
  const gastarPrimero = useMemo(() => expiringSoon.filter((i) => searchedIds.has(i.id)), [expiringSoon, searchedIds]);

  const flatNevera = useMemo(
    () => (now ? sortByExpiry(items.filter((i) => i.location === 'nevera' && searchedIds.has(i.id)), now) : []),
    [items, searchedIds, now]
  );
  const flatAlacena = useMemo(
    () => (now ? sortByExpiry(items.filter((i) => i.location === 'alacena' && searchedIds.has(i.id)), now) : []),
    [items, searchedIds, now]
  );
  const flatVencer = useMemo(() => expiringSoon.filter((i) => searchedIds.has(i.id)), [expiringSoon, searchedIds]);

  async function handleSave(values: InventoryFormValues) {
    const now = new Date().toISOString();
    if (editing && editing !== 'new') {
      await inventoryRepo.update({ ...editing, ...values, updatedAt: now });
    } else {
      await inventoryRepo.add({ id: crypto.randomUUID(), ...values, updatedAt: now });
    }
    setEditing(null);
    refresh();
  }

  async function handleDelete() {
    if (editing && editing !== 'new') {
      await inventoryRepo.remove(editing.id);
    }
    setEditing(null);
    refresh();
  }

  const vencenPronto = expiringSoon.length;

  return (
    <div style={{ position: 'relative', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '26px 24px 12px', borderBottom: '1px solid #E3DED3', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <h1 style={{ fontSize: 32 }}>Despensa</h1>
            <div style={{ fontSize: 13, color: '#766F64' }}>
              {items.length} producto{items.length === 1 ? '' : 's'}
              {vencenPronto > 0 && `, ${vencenPronto} por gastar pronto`}
            </div>
          </div>
          <button
            onClick={() => setEditing('new')}
            aria-label="Agregar producto"
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              border: '1px solid #2B2724',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              background: 'transparent',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2B2724" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #2B2724', padding: '7px 2px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#766F64" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto"
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#2B2724', flex: 1 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 20, overflowX: 'auto' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                fontSize: 13,
                fontWeight: tab === t.id ? 600 : 500,
                color: tab === t.id ? '#2B2724' : '#766F64',
                borderBottom: tab === t.id ? '2px solid #A8412B' : '2px solid transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                padding: '12px 0 8px',
                whiteSpace: 'nowrap',
                background: 'transparent',
              }}
            >
              {t.label}
              {t.id === 'vencer' && vencenPronto > 0 && ` (${vencenPronto})`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 24px 24px' }}>
        {now && (
          <>
            {tab === 'todo' && (
              <>
                {gastarPrimero.length > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '22px 0 8px' }}>
                      <h3 style={{ fontSize: 17 }}>Gastar primero</h3>
                    </div>
                    {gastarPrimero.map((item) => (
                      <InventoryItemRow key={item.id} item={item} now={now} highlighted onClick={() => setEditing(item)} />
                    ))}
                  </>
                )}
                {nevera.length > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '22px 0 8px' }}>
                      <h3 style={{ fontSize: 17 }}>Nevera</h3>
                    </div>
                    {nevera.map((item) => (
                      <InventoryItemRow key={item.id} item={item} now={now} onClick={() => setEditing(item)} />
                    ))}
                  </>
                )}
                {alacena.length > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '22px 0 8px' }}>
                      <h3 style={{ fontSize: 17 }}>Alacena</h3>
                    </div>
                    {alacena.map((item) => (
                      <InventoryItemRow key={item.id} item={item} now={now} onClick={() => setEditing(item)} />
                    ))}
                  </>
                )}
                {items.length === 0 && <EmptyState onAdd={() => setEditing('new')} />}
              </>
            )}

            {tab === 'nevera' &&
              flatNevera.map((item) => <InventoryItemRow key={item.id} item={item} now={now} onClick={() => setEditing(item)} />)}
            {tab === 'alacena' &&
              flatAlacena.map((item) => <InventoryItemRow key={item.id} item={item} now={now} onClick={() => setEditing(item)} />)}
            {tab === 'vencer' &&
              (flatVencer.length > 0 ? (
                flatVencer.map((item) => <InventoryItemRow key={item.id} item={item} now={now} highlighted onClick={() => setEditing(item)} />)
              ) : (
                <p style={{ fontSize: 13, color: '#766F64', padding: '22px 0' }}>Nada por vencer pronto.</p>
              ))}
          </>
        )}
      </div>

      {editing && (
        <InventoryFormSheet
          initial={editing === 'new' ? undefined : editing}
          onSave={handleSave}
          onDelete={editing !== 'new' ? handleDelete : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ padding: '60px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <p style={{ fontSize: 14, color: '#766F64' }}>Tu despensa está vacía.</p>
      <button
        onClick={onAdd}
        style={{
          padding: '12px 20px',
          borderRadius: 10,
          background: '#2B2724',
          color: '#FAF8F4',
          fontWeight: 600,
          fontSize: 14,
          border: 'none',
        }}
      >
        Agregar primer producto
      </button>
    </div>
  );
}
