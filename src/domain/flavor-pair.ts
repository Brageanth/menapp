export type FlavorRelation = 'bien' | 'evitar';

/** Par explícito entre dos componentes — gana siempre sobre el match por flavorProfile/etiquetas. */
export interface FlavorPair {
  id: string;
  componentAId: string;
  componentBId: string;
  relation: FlavorRelation;
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createFlavorPair(id: string, componentAId: string, componentBId: string, relation: FlavorRelation): FlavorPair {
  if (componentAId === componentBId) throw new Error('Un componente no puede tener un par consigo mismo.');
  return { id, componentAId, componentBId, relation, updatedAt: nowIso() };
}

/** Relación explícita entre dos componentes, sin importar el orden en que se guardó el par. */
export function relationBetween(pairs: FlavorPair[], aId: string, bId: string): FlavorRelation | null {
  const match = pairs.find(
    (p) => (p.componentAId === aId && p.componentBId === bId) || (p.componentAId === bId && p.componentBId === aId)
  );
  return match?.relation ?? null;
}

export function pairsFor(pairs: FlavorPair[], componentId: string): FlavorPair[] {
  return pairs.filter((p) => p.componentAId === componentId || p.componentBId === componentId);
}
