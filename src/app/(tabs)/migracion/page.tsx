'use client';

import { useEffect, useMemo, useState } from 'react';
import { recipeRepo } from '@/data/repositories/recipe-repo';
import { recipeMigrationRepo } from '@/data/repositories/recipe-migration-repo';
import { componentRepo } from '@/data/repositories/component-repo';
import type { Recipe } from '@/domain/recipe';
import {
  confirmMigration,
  createPendingMigration,
  heuristicDecision,
  markApplied,
  migrationProgress,
  proposeMigration,
  type MigrationDecision,
  type ProposedComponent,
  type RecipeMigrationRecord,
} from '@/domain/recipe-migration';
import { createComponent, type NewComponentInput, type RoleId } from '@/domain/component';

interface AiProposedComponent {
  name: string;
  roles: RoleId[];
  unit: string;
  macrosBasis: 'per100g' | 'perUnit';
  macros: { kcal: number; protein: number; carbs: number; fat: number };
  portionTypical: number;
}

export default function MigracionPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [records, setRecords] = useState<RecipeMigrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [draftDecision, setDraftDecision] = useState<MigrationDecision | null>(null);
  const [draftComponents, setDraftComponents] = useState<AiProposedComponent[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    let ignore = false;
    Promise.all([recipeRepo.list(), recipeMigrationRepo.list()]).then(([r, m]) => {
      if (ignore) return;
      setRecipes(r);
      setRecords(m);
      setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const progress = useMemo(() => migrationProgress(records), [records]);
  const recordByRecipeId = useMemo(() => new Map(records.map((r) => [r.recipeId, r])), [records]);

  const current = useMemo(() => {
    const recipe = recipes.find((r) => {
      const record = recordByRecipeId.get(r.id);
      return !record || record.status !== 'applied';
    });
    if (!recipe) return null;
    return { recipe, record: recordByRecipeId.get(recipe.id) };
  }, [recipes, recordByRecipeId]);

  async function ensureRecord(recipeId: string): Promise<RecipeMigrationRecord> {
    const existing = recordByRecipeId.get(recipeId);
    if (existing) return existing;
    const created = createPendingMigration(crypto.randomUUID(), recipeId);
    await recipeMigrationRepo.add(created);
    setRecords((prev) => [...prev, created]);
    return created;
  }

  async function handleProposeWithAi() {
    if (!current) return;
    setAiLoading(true);
    try {
      const record = await ensureRecord(current.recipe.id);
      const res = await fetch('/api/decompose-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe: current.recipe }),
      });
      if (!res.ok) throw new Error('fallo');
      const result = await res.json();
      setDraftDecision(result.decision);
      setDraftComponents(result.proposedComponents);
      setNote(result.note);
      const proposed = proposeMigration(record, result.decision, [], result.note);
      await recipeMigrationRepo.update(proposed);
      setRecords((prev) => prev.map((r) => (r.id === proposed.id ? proposed : r)));
    } catch {
      setDraftDecision(heuristicDecision(current.recipe));
      setDraftComponents([]);
      setNote('No se pudo contactar la IA — se propone con la heurística simple, revisá a mano.');
    } finally {
      setAiLoading(false);
    }
  }

  function useHeuristic() {
    if (!current) return;
    setDraftDecision(heuristicDecision(current.recipe));
    setDraftComponents([]);
    setNote('Propuesta por heurística — sin componentes sugeridos, agregalos a mano después.');
  }

  async function handleConfirmAndApply() {
    if (!current || !draftDecision) return;
    const record = await ensureRecord(current.recipe.id);

    const createdComponentIds: string[] = [];
    if (draftDecision !== 'archive') {
      for (const dc of draftComponents) {
        const input: NewComponentInput = {
          name: dc.name,
          roles: dc.roles,
          origin: 'simple',
          unit: dc.unit,
          portion: { typical: dc.portionTypical, min: dc.portionTypical * 0.5, max: dc.portionTypical * 2, step: 10 },
          weightState: 'cocido',
          macrosBasis: dc.macrosBasis,
          macros: dc.macros,
          isTreat: false,
          isCompleteDish: draftDecision === 'complete-dish',
          notes: `Migrado desde la receta "${current.recipe.name}".`,
        };
        const component = createComponent(crypto.randomUUID(), input);
        await componentRepo.add(component);
        createdComponentIds.push(component.id);
      }
    }

    const proposedComponents: ProposedComponent[] = createdComponentIds.map((id) => ({ existingComponentId: id }));
    let next = confirmMigration(record, draftDecision, proposedComponents);
    next = markApplied(next);
    await recipeMigrationRepo.update(next);
    setRecords((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    setDraftDecision(null);
    setDraftComponents([]);
    setNote('');
  }

  async function handleArchiveRecipe() {
    if (!current) return;
    const record = await ensureRecord(current.recipe.id);
    let next = proposeMigration(record, 'archive', [], 'Archivada sin migrar — ya no se usa.');
    next = confirmMigration(next, 'archive', []);
    next = markApplied(next);
    await recipeMigrationRepo.update(next);
    setRecords((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    setDraftDecision(null);
    setDraftComponents([]);
    setNote('');
  }

  if (loading) return null;

  return (
    <div style={{ padding: '26px 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h1 style={{ fontSize: 32 }}>Migración</h1>
      <div style={{ fontSize: 13, color: '#766F64' }}>
        {progress.applied} de {recipes.length} recetas migradas
      </div>
      <div style={{ height: 6, borderRadius: 999, background: '#E3DED3', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${recipes.length ? (progress.applied / recipes.length) * 100 : 0}%`, background: '#3F7D4F' }} />
      </div>

      {!current ? (
        <p style={{ fontSize: 14, color: '#3F7D4F', fontWeight: 600 }}>¡Listo! Todas las recetas están revisadas.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ border: '1px solid #E3DED3', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#2B2724' }}>{current.recipe.name}</span>
            <span style={{ fontSize: 12.5, color: '#766F64' }}>
              {current.recipe.ingredients.length} ingredientes · {current.recipe.steps.length} pasos
            </span>
          </div>

          {draftDecision === null ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleProposeWithAi} disabled={aiLoading} style={{ flex: 1, padding: 14, borderRadius: 10, background: '#2B2724', color: '#FAF8F4', fontWeight: 600, fontSize: 14, border: 'none', opacity: aiLoading ? 0.6 : 1 }}>
                {aiLoading ? 'Pensando…' : 'Proponer con IA'}
              </button>
              <button onClick={useHeuristic} style={{ padding: 14, borderRadius: 10, background: 'transparent', color: '#2B2724', fontWeight: 600, fontSize: 14, border: '1px solid #E3DED3' }}>
                Sin IA
              </button>
              <button onClick={handleArchiveRecipe} style={{ padding: 14, borderRadius: 10, background: 'transparent', color: '#A8412B', fontWeight: 600, fontSize: 14, border: '1px solid #A8412B' }}>
                Archivar
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, color: '#766F64' }}>{note}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['separable', 'complete-dish'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDraftDecision(d)}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 8,
                      border: draftDecision === d ? '1px solid #2B2724' : '1px solid #E3DED3',
                      background: draftDecision === d ? '#2B2724' : 'transparent',
                      color: draftDecision === d ? '#FAF8F4' : '#2B2724',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {d === 'separable' ? 'Separable en componentes' : 'Plato completo'}
                  </button>
                ))}
              </div>

              {draftComponents.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {draftComponents.map((c, i) => (
                    <div key={i} style={{ fontSize: 13, color: '#2B2724', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E3DED3', padding: '8px 0' }}>
                      <span>{c.name} <span style={{ color: '#766F64' }}>({c.roles.join(', ')})</span></span>
                      <span style={{ color: '#766F64' }}>{Math.round(c.macros.kcal)} kcal</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setDraftDecision(null); setDraftComponents([]); }} style={{ padding: 14, borderRadius: 10, background: 'transparent', color: '#766F64', fontWeight: 600, fontSize: 14, border: '1px solid #E3DED3' }}>
                  Volver
                </button>
                <button onClick={handleConfirmAndApply} style={{ flex: 1, padding: 14, borderRadius: 10, background: '#2B2724', color: '#FAF8F4', fontWeight: 600, fontSize: 14, border: 'none' }}>
                  Confirmar y aplicar
                </button>
              </div>
            </div>
          )}

          <p style={{ fontSize: 12, color: '#766F64' }}>Podés salir de esta pantalla y volver después — el progreso queda guardado.</p>
        </div>
      )}
    </div>
  );
}
