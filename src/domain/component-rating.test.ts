import { describe, expect, it } from 'vitest';
import { applyRating, ratingScore } from './component-rating';

describe('applyRating', () => {
  it('crea una calificación nueva si no existía', () => {
    const result = applyRating([], 'pollo', 1);
    expect(ratingScore(result, 'pollo')).toBe(1);
  });

  it('acumula sobre una existente', () => {
    let ratings = applyRating([], 'pollo', 1);
    ratings = applyRating(ratings, 'pollo', 1);
    expect(ratingScore(ratings, 'pollo')).toBe(2);
  });

  it('permite bajar con calificación negativa', () => {
    let ratings = applyRating([], 'pollo', 1);
    ratings = applyRating(ratings, 'pollo', -1);
    expect(ratingScore(ratings, 'pollo')).toBe(0);
  });

  it('no afecta la calificación de otros componentes', () => {
    const ratings = applyRating([{ id: 'arroz', componentId: 'arroz', score: 3, updatedAt: '' }], 'pollo', 1);
    expect(ratingScore(ratings, 'arroz')).toBe(3);
  });
});

describe('ratingScore', () => {
  it('devuelve 0 si no hay calificación', () => {
    expect(ratingScore([], 'pollo')).toBe(0);
  });
});
