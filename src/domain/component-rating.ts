/**
 * E4: aprendizaje simple por calificación de uso — un contador acumulado por componente.
 * `id` repite `componentId` (una fila por componente) para calzar con el helper genérico de
 * sincronización, que espera un campo `id` en toda tabla.
 */
export interface ComponentRating {
  id: string;
  componentId: string;
  score: number;
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function applyRating(ratings: ComponentRating[], componentId: string, delta: 1 | -1): ComponentRating[] {
  const existing = ratings.find((r) => r.componentId === componentId);
  if (!existing) {
    return [...ratings, { id: componentId, componentId, score: delta, updatedAt: nowIso() }];
  }
  return ratings.map((r) => (r.componentId === componentId ? { ...r, score: r.score + delta, updatedAt: nowIso() } : r));
}

export function ratingScore(ratings: ComponentRating[], componentId: string): number {
  return ratings.find((r) => r.componentId === componentId)?.score ?? 0;
}
