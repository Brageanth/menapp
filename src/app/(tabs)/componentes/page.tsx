'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { componentRepo } from '@/data/repositories/component-repo';
import {
  archiveComponent,
  createComponent,
  filterComponents,
  findDuplicateComponent,
  reviseComponent,
  SEED_ROLES,
  type Component,
  type NewComponentInput,
  type RoleId,
} from '@/domain/component';
import { ComponentRow } from '@/components/component-row';

const ComponentFormSheet = dynamic(() => import('@/components/component-form-sheet').then((m) => m.ComponentFormSheet));

export default function ComponentesPage() {
  const [components, setComponents] = useState<Component[]>([]);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<RoleId | null>(null);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [editing, setEditing] = useState<Component | 'new' | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setComponents(await componentRepo.list());
  }, []);

  useEffect(() => {
    let ignore = false;
    componentRepo
      .list()
      .then((all) => {
        if (!ignore) setComponents(all);
      })
      .catch((err) => console.error('[componentes] list failed', err));
    return () => {
      ignore = true;
    };
  }, []);

  const filtered = useMemo(
    () => filterComponents(components, { query, role: role ?? undefined, favoriteOnly }),
    [components, query, role, favoriteOnly]
  );

  async function handleSave(input: NewComponentInput) {
    setDuplicateWarning(null);
    if (editing === 'new' || !editing) {
      const dup = findDuplicateComponent(components, input.name);
      if (dup) {
        setDuplicateWarning(`Ya existe "${dup.name}" — revisá antes de crear uno nuevo.`);
        return;
      }
      await componentRepo.add(createComponent(crypto.randomUUID(), input));
    } else {
      await componentRepo.update(reviseComponent(editing, input));
    }
    setEditing(null);
    refresh();
  }

  async function handleArchive() {
    if (editing && editing !== 'new') {
      await componentRepo.update(archiveComponent(editing));
    }
    setEditing(null);
    refresh();
  }

  return (
    <div style={{ position: 'relative', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '26px 24px 12px', borderBottom: '1px solid #E3DED3', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <h1 style={{ fontSize: 32 }}>Componentes</h1>
            <div style={{ fontSize: 13, color: '#766F64' }}>{filtered.length} de {components.filter((c) => c.status === 'active').length}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => {
                setDuplicateWarning(null);
                setEditing('new');
              }}
              aria-label="Agregar componente"
              style={{ width: 44, height: 44, borderRadius: 999, border: '1px solid #2B2724', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', touchAction: 'manipulation', flexShrink: 0 }}
            >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2B2724" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #2B2724', padding: '7px 2px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#766F64" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar componente"
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#2B2724', flex: 1 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          <RoleChip label="Todos" active={role === null} onClick={() => setRole(null)} />
          {SEED_ROLES.map((r) => (
            <RoleChip key={r.id} label={r.label} active={role === r.id} onClick={() => setRole(r.id)} />
          ))}
          <RoleChip label="★ Favoritos" active={favoriteOnly} onClick={() => setFavoriteOnly((v) => !v)} />
        </div>
      </div>

      <div style={{ flex: 1, padding: '4px 24px 24px' }}>
        {filtered.length === 0 ? (
          <EmptyState onAdd={() => setEditing('new')} hasAny={components.length > 0} />
        ) : (
          filtered.map((c) => <ComponentRow key={c.id} component={c} onClick={() => setEditing(c)} />)
        )}
      </div>

      {editing && (
        <ComponentFormSheet
          initial={editing === 'new' ? undefined : editing}
          onSave={handleSave}
          onArchive={editing !== 'new' ? handleArchive : undefined}
          onClose={() => {
            setEditing(null);
            setDuplicateWarning(null);
          }}
        />
      )}
      {duplicateWarning && (
        <div style={{ position: 'fixed', bottom: 90, left: 16, right: 16, maxWidth: 448, margin: '0 auto', background: '#2B2724', color: '#FAF8F4', borderRadius: 10, padding: '12px 16px', fontSize: 13, zIndex: 60 }}>
          {duplicateWarning}
        </div>
      )}
    </div>
  );
}

function RoleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '8px 14px',
        borderRadius: 999,
        border: active ? '1px solid #2B2724' : '1px solid #E3DED3',
        background: active ? '#2B2724' : 'transparent',
        color: active ? '#FAF8F4' : '#766F64',
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function EmptyState({ onAdd, hasAny }: { onAdd: () => void; hasAny: boolean }) {
  return (
    <div style={{ padding: '60px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <p style={{ fontSize: 14, color: '#766F64' }}>{hasAny ? 'Nada coincide con el filtro.' : 'Todavía no tenés componentes.'}</p>
      {!hasAny && (
        <button onClick={onAdd} style={{ padding: '12px 20px', borderRadius: 10, background: '#2B2724', color: '#FAF8F4', fontWeight: 600, fontSize: 14, border: 'none' }}>
          Agregar primer componente
        </button>
      )}
    </div>
  );
}
