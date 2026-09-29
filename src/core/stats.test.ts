import { describe, expect, it } from 'vitest';
import {
  blockCounts,
  currentBlock,
  dueCount,
  forecast,
  newLeft,
  nextDue,
  progressPercent,
  recordHistory,
  rollToday,
  statusCounts,
  streak,
} from './stats';
import type { Settings, WordsMap } from './types';

const D = 20_000;

const words: WordsMap = {
  1: { s: 'known', u: 0 },
  2: { s: 'known', u: 0 },
  3: { s: 'queued', u: 0 },
  4: { s: 'learning', st: 1, due: D - 3, u: 0 },
  5: { s: 'learning', st: 2, due: D, u: 0 },
  6: { s: 'learning', st: 3, due: D + 2, u: 0 },
  7: { s: 'mastered', due: D + 2, u: 0 },
  8: { s: 'mastered', u: 0 },
  60: { s: 'learning', st: 4, due: D + 9, u: 0 },
};

describe('статистика', () => {
  it('рахує статуси всіх слів і блоку', () => {
    expect(statusCounts(words)).toEqual({
      new: 2801 - 9,
      known: 2,
      queued: 1,
      learning: 4,
      mastered: 2,
    });
    expect(blockCounts(words, 2)).toEqual({
      new: 49,
      known: 0,
      queued: 0,
      learning: 1,
      mastered: 0,
    });
    expect(progressPercent(statusCounts(words))).toBeCloseTo((4 / 2801) * 100);
  });

  it('поточний блок — перший із невідсортованими', () => {
    expect(currentBlock(words)).toBe(1);
    const all: WordsMap = {};
    for (let r = 1; r <= 100; r++) all[r] = { s: 'known', u: 0 };
    expect(currentBlock(all)).toBe(3);
  });

  it('повторення сьогодні, прогноз і наступне', () => {
    expect(dueCount(words, D)).toBe(2);
    expect(forecast(words, D)).toEqual([2, 0, 2, 0, 0, 0, 0]);
    expect(nextDue(words, D)).toEqual({ day: D + 2, count: 2 });
    expect(nextDue({}, D)).toBeNull();
  });

  it('серія рахується до сьогодні або до вчора', () => {
    const h = { [D - 3]: [5, 0, 0], [D - 2]: [0, 10, 1], [D - 1]: [3, 3, 0] } as const;
    const history = Object.fromEntries(
      Object.entries(h).map(([d, e]) => [d, [...e] as [number, number, number]]),
    );
    expect(streak(history, D)).toBe(3);
    expect(streak({ ...history, [D]: [1, 0, 0] }, D)).toBe(4);
    expect(streak(history, D + 1)).toBe(0);
  });

  it('історія додає лічильники й тримає 180 днів', () => {
    let h = recordHistory({ [D - 200]: [1, 1, 0] }, D, 1);
    h = recordHistory(h, D, 1);
    h = recordHistory(h, D, 2);
    expect(h).toEqual({ [D]: [0, 2, 1] });
  });

  it('денний ліміт і новий день', () => {
    const settings: Settings = {
      dailyNew: 15,
      autoSpeak: true,
      theme: 'system',
      controlReview: true,
    };
    expect(newLeft({ day: D, newDone: 12, extra: 0 }, settings)).toBe(3);
    expect(newLeft({ day: D, newDone: 15, extra: 5 }, settings)).toBe(5);
    expect(newLeft({ day: D, newDone: 30, extra: 0 }, settings)).toBe(0);
    expect(rollToday({ day: D - 1, newDone: 9, extra: 5 }, D)).toEqual({
      day: D,
      newDone: 0,
      extra: 0,
    });
  });
});
