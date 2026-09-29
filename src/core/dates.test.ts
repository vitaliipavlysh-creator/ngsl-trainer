import { describe, expect, it } from 'vitest';
import { dayLabel, dayNumber, dayToDate } from './dates';

describe('dayNumber', () => {
  it('новий день починається о 04:00', () => {
    const evening = dayNumber(new Date(2026, 8, 29, 23, 30));
    expect(dayNumber(new Date(2026, 8, 30, 3, 59))).toBe(evening);
    expect(dayNumber(new Date(2026, 8, 30, 4, 0))).toBe(evening + 1);
  });

  it('рахує календарні дні через перехід на зимовий час', () => {
    const before = dayNumber(new Date(2026, 9, 24, 12));
    expect(dayNumber(new Date(2026, 9, 26, 12))).toBe(before + 2);
  });

  it('межа року і високосний день', () => {
    expect(dayNumber(new Date(2028, 2, 1, 12)) - dayNumber(new Date(2028, 1, 28, 12))).toBe(2);
    expect(dayNumber(new Date(2027, 0, 1, 12)) - dayNumber(new Date(2026, 11, 31, 12))).toBe(1);
  });

  it('dayToDate — обернена до dayNumber', () => {
    const day = dayNumber(new Date(2026, 8, 29, 12));
    const date = dayToDate(day);
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 8, 29]);
  });
});

describe('dayLabel', () => {
  it('сьогодні / завтра', () => {
    expect(dayLabel(100, 100)).toBe('сьогодні');
    expect(dayLabel(99, 100)).toBe('сьогодні');
    expect(dayLabel(101, 100)).toBe('завтра');
  });
});
