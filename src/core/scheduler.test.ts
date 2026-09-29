import { describe, expect, it } from 'vitest';
import {
  answerReview,
  dueOrder,
  enqueue,
  isLeech,
  markKnown,
  queuedOrder,
  reviewDirection,
  sortBlock,
  startLearning,
} from './scheduler';
import type { WordState, WordsMap } from './types';

const D = 20_000;
const NOW = 1_000;

describe('повний цикл слова', () => {
  it('queued → learning 1..4 → mastered → контроль (1/3/7/21/60)', () => {
    let ws: WordState = enqueue(undefined, NOW);
    expect(ws.s).toBe('queued');

    ws = startLearning(ws, D, NOW);
    expect(ws).toMatchObject({ s: 'learning', st: 1, due: D + 1 });
    expect(reviewDirection(ws)).toBe('en-ua');

    ws = answerReview(ws, true, D + 1, NOW, true);
    expect(ws).toMatchObject({ s: 'learning', st: 2, due: D + 4 });
    expect(reviewDirection(ws)).toBe('en-ua');

    ws = answerReview(ws, true, D + 4, NOW, true);
    expect(ws).toMatchObject({ s: 'learning', st: 3, due: D + 11 });
    expect(reviewDirection(ws)).toBe('ua-en');

    ws = answerReview(ws, true, D + 11, NOW, true);
    expect(ws).toMatchObject({ s: 'learning', st: 4, due: D + 32 });
    expect(reviewDirection(ws)).toBe('ua-en');

    ws = answerReview(ws, true, D + 32, NOW, true);
    expect(ws).toMatchObject({ s: 'mastered', due: D + 92 });
    expect(reviewDirection(ws)).toBe('ua-en');

    ws = answerReview(ws, true, D + 92, NOW, true);
    expect(ws).toEqual({ s: 'mastered', u: NOW });
  });

  it('без контрольного повторення mastered не має due', () => {
    const ws: WordState = { s: 'learning', st: 4, due: D, u: 0 };
    expect(answerReview(ws, true, D, NOW, false)).toEqual({ s: 'mastered', u: NOW });
  });

  it.each([1, 2, 3, 4] as const)('«Забув» на етапі %i → етап 1, завтра, lapses+1', (st) => {
    const ws: WordState = { s: 'learning', st, due: D, lapses: 1, u: 0 };
    expect(answerReview(ws, false, D, NOW, true)).toEqual({
      s: 'learning',
      st: 1,
      due: D + 1,
      lapses: 2,
      u: NOW,
    });
  });

  it('«Забув» на контролі повертає у вивчення', () => {
    const ws: WordState = { s: 'mastered', due: D, u: 0 };
    expect(answerReview(ws, false, D, NOW, true)).toMatchObject({
      s: 'learning',
      st: 1,
      lapses: 1,
    });
  });

  it('інтервал рахується від дня відповіді, а не від due', () => {
    const ws: WordState = { s: 'learning', st: 1, due: D, u: 0 };
    expect(answerReview(ws, true, D + 5, NOW, true).due).toBe(D + 5 + 3);
  });

  it('важке слово з 4 помилок', () => {
    expect(isLeech({ s: 'learning', st: 1, lapses: 3, u: 0 })).toBe(false);
    expect(isLeech({ s: 'learning', st: 1, lapses: 4, u: 0 })).toBe(true);
  });

  it('ручні дії зберігають lapses', () => {
    const prev: WordState = { s: 'learning', st: 2, due: D, lapses: 3, u: 0 };
    expect(markKnown(prev, NOW)).toEqual({ s: 'known', lapses: 3, u: NOW });
    expect(enqueue(prev, NOW, true)).toEqual({ s: 'queued', q: NOW, lapses: 3, u: NOW });
  });
});

describe('sortBlock', () => {
  it('позначені → queued, решта → known, learning/mastered не чіпає', () => {
    const words: WordsMap = {
      3: { s: 'learning', st: 2, due: D, u: 1 },
      4: { s: 'mastered', u: 1 },
      5: { s: 'queued', q: 7, u: 1 },
    };
    const next = sortBlock(words, [1, 2, 3, 4, 5], new Set([2, 3, 5]), NOW);
    expect(next[1]).toEqual({ s: 'known', u: NOW });
    expect(next[2]).toEqual({ s: 'queued', u: NOW });
    expect(next[3]).toBe(words[3]);
    expect(next[4]).toBe(words[4]);
    expect(next[5]).toBe(words[5]);
    expect(words[1]).toBeUndefined();
  });

  it('повторне збереження змінює вибір', () => {
    const words: WordsMap = { 1: { s: 'queued', u: 1 }, 2: { s: 'known', u: 1 } };
    const next = sortBlock(words, [1, 2], new Set([2]), NOW);
    expect(next[1]?.s).toBe('known');
    expect(next[2]?.s).toBe('queued');
  });
});

describe('черги', () => {
  const words: WordsMap = {
    30: { s: 'queued', u: 0 },
    10: { s: 'queued', u: 0 },
    99: { s: 'queued', q: 200, u: 0 },
    77: { s: 'queued', q: 100, u: 0 },
    5: { s: 'known', u: 0 },
    40: { s: 'learning', st: 1, due: D, u: 0 },
    41: { s: 'learning', st: 3, due: D - 2, u: 0 },
    42: { s: 'learning', st: 2, due: D + 1, u: 0 },
    43: { s: 'mastered', due: D - 2, u: 0 },
    44: { s: 'mastered', u: 0 },
  };

  it('нові: спершу вручну додані за часом, далі за рангом', () => {
    expect(queuedOrder(words)).toEqual([77, 99, 10, 30]);
  });

  it('повторення: прострочені першими, далі за рангом', () => {
    expect(dueOrder(words, D)).toEqual([41, 43, 40]);
  });
});
