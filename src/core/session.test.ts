import { describe, expect, it } from 'vitest';
import {
  createLearnSession,
  createReviewSession,
  learnAnswer,
  learnMarkKnown,
  learnNext,
  learnProgress,
  reviewAnswer,
  reviewProgress,
  shuffle,
  startRound,
  type LearnSession,
} from './session';

/** Детермінований генератор для тестів. */
function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

function passIntros(s: LearnSession): LearnSession {
  while (s.queue[0]?.kind === 'intro') s = learnNext(s);
  return s;
}

describe('вивчення нових', () => {
  it('пачки по 5: спершу знайомство, потім перевірка тих самих слів', () => {
    const s = createLearnSession(range(1, 12), 7, seeded());
    expect(s.pack).toEqual([1, 2, 3, 4, 5]);
    expect(s.queue.slice(0, 5)).toEqual(range(1, 5).map((rank) => ({ rank, kind: 'intro' })));
    const checks = s.queue.slice(5);
    expect(checks.every((c) => c.kind === 'check')).toBe(true);
    expect(checks.map((c) => c.rank).sort((a, b) => a - b)).toEqual(range(1, 5));
    expect(learnProgress(s)).toEqual({ done: 0, total: 7 });
  });

  it('проходить ліміт двома пачками (5 + 2) і завершується', () => {
    let s = createLearnSession(range(1, 12), 7, seeded());
    s = passIntros(s);
    for (let i = 0; i < 5; i++) s = learnAnswer(s, true);
    expect(s.learned).toHaveLength(5);
    expect(s.pack).toEqual([6, 7]);
    s = passIntros(s);
    s = learnAnswer(learnAnswer(s, true), true);
    expect(s.queue).toEqual([]);
    expect(s.learned.sort((a, b) => a - b)).toEqual(range(1, 7));
    expect(learnProgress(s)).toEqual({ done: 7, total: 7 });
  });

  it('«Забув» повертає картку через 4 позиції й повторює, доки не згадаю', () => {
    let s = passIntros(createLearnSession(range(1, 5), 5, seeded()));
    const first = s.queue[0]?.rank;
    s = learnAnswer(s, false);
    expect(s.queue).toHaveLength(5);
    expect(s.queue[4]).toEqual({ rank: first, kind: 'check' });
    expect(s.forgot).toBe(1);
    while (s.queue.length) s = learnAnswer(s, true);
    expect(s.learned).toHaveLength(5);
  });

  it('«Я це знаю» замінює слово наступним із черги', () => {
    let s = createLearnSession(range(1, 10), 5, seeded());
    s = learnMarkKnown(s, seeded());
    expect(s.knownMarked).toEqual([1]);
    expect(s.pack).toEqual([2, 3, 4, 5, 6]);
    expect(s.queue.filter((c) => c.kind === 'intro').map((c) => c.rank)).toEqual([2, 3, 4, 5, 6]);
    expect(
      s.queue
        .filter((c) => c.kind === 'check')
        .map((c) => c.rank)
        .sort(),
    ).toEqual([2, 3, 4, 5, 6]);
    expect(s.candidates).toEqual(range(7, 10));
    expect(learnProgress(s).total).toBe(5);
  });

  it('«Я це знаю» без запасу в черзі зменшує пачку', () => {
    let s = createLearnSession([1, 2], 5, seeded());
    s = learnMarkKnown(s);
    expect(s.pack).toEqual([2]);
    s = learnMarkKnown(s);
    expect(s.queue).toEqual([]);
    expect(s.knownMarked).toEqual([1, 2]);
  });

  it('порожня черга або нульовий ліміт — сесія одразу порожня', () => {
    expect(createLearnSession([], 15).queue).toEqual([]);
    expect(createLearnSession([1, 2], 0).queue).toEqual([]);
  });
});

describe('повторення', () => {
  const cards = range(1, 40).map((rank) => ({ rank, dir: 'en-ua' as const }));

  it('раунди по 30 карток', () => {
    let s = createReviewSession(cards);
    expect(s.queue).toHaveLength(30);
    expect(s.pending).toHaveLength(10);
    while (s.queue.length) s = reviewAnswer(s, true);
    expect(s.round).toEqual({ remembered: 30, forgot: 0 });
    s = startRound(s);
    expect(s.queue).toHaveLength(10);
    expect(s.round).toEqual({ remembered: 0, forgot: 0 });
    expect(s.total.remembered).toBe(30);
  });

  it('«Забув» → до 3 вправ у сесії, лічиться лише перша відповідь', () => {
    let s = createReviewSession(cards.slice(0, 6));
    s = reviewAnswer(s, false);
    expect(s.queue[4]).toEqual({ rank: 1, dir: 'en-ua', attempt: 1 });
    expect(reviewProgress(s)).toEqual({ done: 1, total: 6 });
    // Забуваю і всі вправи: слово зʼявляється ще рівно 3 рази.
    let shows = 0;
    while (s.queue.length) {
      const card = s.queue[0];
      if (card?.rank === 1) shows++;
      s = reviewAnswer(s, card?.rank !== 1);
    }
    expect(shows).toBe(3);
    expect(s.total).toEqual({ remembered: 5, forgot: 1 });
  });

  it('згадане на вправі більше не показується', () => {
    let s = createReviewSession(cards.slice(0, 2));
    s = reviewAnswer(s, false);
    s = reviewAnswer(s, true);
    expect(s.queue).toEqual([{ rank: 1, dir: 'en-ua', attempt: 1 }]);
    s = reviewAnswer(s, true);
    expect(s.queue).toEqual([]);
  });
});

describe('shuffle', () => {
  it('переставляє без втрат', () => {
    expect(shuffle(range(1, 20), seeded(7)).sort((a, b) => a - b)).toEqual(range(1, 20));
  });
});
