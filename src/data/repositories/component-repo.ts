import { db } from '../local-db';
import { enqueueWrite } from '../sync-queue';
import { mergePulledRows } from '../sync-pull';
import { supabase } from '../supabase-client';
import type { Component } from '@/domain/component';

/** Supabase columns are snake_case; local/domain objects are camelCase. */
function toRow(component: Component) {
  return {
    id: component.id,
    name: component.name,
    roles: component.roles,
    origin: component.origin,
    unit: component.unit,
    portion: component.portion,
    weight_state: component.weightState,
    macros_basis: component.macrosBasis,
    macros: component.macros,
    is_treat: component.isTreat,
    flavor_profile: component.flavorProfile ?? null,
    typical_slots: component.typicalSlots ?? null,
    temperature: component.temperature ?? null,
    effort: component.effort ?? null,
    cooked_shelf_life_days: component.cookedShelfLifeDays ?? null,
    batchable: component.batchable ?? null,
    ingredients: component.ingredients ?? null,
    steps: component.steps ?? null,
    is_complete_dish: component.isCompleteDish ?? null,
    favorite: component.favorite ?? null,
    status: component.status,
    notes: component.notes ?? null,
    version: component.version,
    parent_component_id: component.parentComponentId ?? null,
    updated_at: component.updatedAt,
  };
}

function fromRow(row: Record<string, unknown>): Component {
  return {
    id: row.id as string,
    name: row.name as string,
    roles: row.roles as Component['roles'],
    origin: row.origin as Component['origin'],
    unit: row.unit as string,
    portion: row.portion as Component['portion'],
    weightState: row.weight_state as Component['weightState'],
    macrosBasis: row.macros_basis as Component['macrosBasis'],
    macros: row.macros as Component['macros'],
    isTreat: Boolean(row.is_treat),
    flavorProfile: (row.flavor_profile as string[] | null) ?? undefined,
    typicalSlots: (row.typical_slots as Component['typicalSlots']) ?? undefined,
    temperature: (row.temperature as Component['temperature'] | null) ?? undefined,
    effort: (row.effort as Component['effort'] | null) ?? undefined,
    cookedShelfLifeDays: (row.cooked_shelf_life_days as number | null) ?? undefined,
    batchable: (row.batchable as boolean | null) ?? undefined,
    ingredients: (row.ingredients as Component['ingredients'] | null) ?? undefined,
    steps: (row.steps as string[] | null) ?? undefined,
    isCompleteDish: (row.is_complete_dish as boolean | null) ?? undefined,
    favorite: (row.favorite as boolean | null) ?? undefined,
    status: row.status as Component['status'],
    notes: (row.notes as string | null) ?? undefined,
    version: Number(row.version),
    parentComponentId: (row.parent_component_id as string | null) ?? undefined,
    updatedAt: row.updated_at as string,
  };
}

export const componentRepo = {
  async list(): Promise<Component[]> {
    return db.components.toArray();
  },

  async add(component: Component): Promise<void> {
    await db.components.add(component);
    await enqueueWrite('components', 'insert', toRow(component));
  },

  async update(component: Component): Promise<void> {
    await db.components.put(component);
    await enqueueWrite('components', 'update', toRow(component));
  },

  async remove(id: string): Promise<void> {
    await db.components.delete(id);
    await enqueueWrite('components', 'delete', { id });
  },

  async pullFromRemote(): Promise<void> {
    const { data } = await supabase.from('components').select('*');
    if (data) await mergePulledRows(db.components, data.map(fromRow), (c) => c.updatedAt);
  },
};
