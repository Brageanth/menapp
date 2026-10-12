import { describe, expect, it } from 'vitest';
import { startOfWeek, toDateKey, todayDate, weekDates } from './date';

describe('startOfWeek', () => {
  it('retrocede al lunes de esa semana', () => {
    const wed = new Date('2026-10-14T12:00:00');
    expect(toDateKey(startOfWeek(wed))).toBe('2026-10-12');
  });

  it('un domingo retrocede 6 días al lunes anterior', () => {
    const sun = new Date('2026-10-18T12:00:00');
    expect(toDateKey(startOfWeek(sun))).toBe('2026-10-12');
  });
});

describe('weekDates', () => {
  it('genera los 7 días desde el inicio', () => {
    const monday = new Date('2026-10-12T00:00:00');
    expect(weekDates(monday)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  });
});

describe('todayDate', () => {
  it('devuelve una fecha con formato YYYY-MM-DD', () => {
    expect(todayDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
