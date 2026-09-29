import { describe, expect, it } from 'vitest';
import { blockRanks } from '../core/blocks';
import { dayNumber } from '../core/dates';
import { SCHEMA_VERSION, initialState, migrate } from './state';
import { createAppStore } from './store';

const HOUR = 3_600_000;
const START = new Date(2026, 9, 1, 10).getTime();

function setup() {
  let now = START;
  const store = createAppStore({ clock: () => now, rng: () => 0.5 });
  store.getState().hydrate(initialState(now));
  return {
    store,
    get: () => store.getState(),
    advance: (hours: number) => (now += hours * HOUR),
  };
}

/** Проходить усі картки-знайомства поточної пачки. */
function passIntros(get: () => ReturnType<ReturnType<typeof createAppStore>['getState']>) {
  for (let s = get().session; s?.kind === 'learn' && s.s.queue[0]?.kind === 'intro';) {
    get().learnNext();
    s = get().session;
  }
}

describe('сортування', () => {
  it('зберігає блок і ставить позначені в чергу', () => {
    const { get } = setup();
    get().saveBlock(1, new Set([3, 7]));
    const { words, updatedAt } = get().app;
    expect(Object.keys(words)).toHaveLength(50);
    expect(words[3]?.s).toBe('queued');
    expect(words[1]?.s).toBe('known');
    expect(updatedAt).toBe(START);
  });
});

describe('вивчення нових', () => {
  it('ліміт, «Згадав», лічильники й історія', () => {
    const { get } = setup();
    get().updateSettings({ dailyNew: 10 });
    get().saveBlock(1, new Set(blockRanks(1).slice(0, 12)));
    expect(get().startLearn()).toBe(true);

    let guard = 0;
    while (get().session?.s.queue.length && guard++ < 100) {
      passIntros(get);
      if (get().session?.s.queue.length) get().answer(true);
    }
    const day = dayNumber(new Date(START));
    expect(get().app.today).toEqual({ day, newDone: 10, extra: 0 });
    expect(get().app.history[day]).toEqual([10, 0, 0]);
    expect(get().app.words[1]).toMatchObject({ s: 'learning', st: 1, due: day + 1 });
    expect(get().app.words[11]?.s).toBe('queued');

    // Ліміт вичерпано → звичайний старт порожній, «Ще 5 слів» додає пʼять.
    expect(get().startLearn()).toBe(false);
    expect(get().startLearn(true)).toBe(true);
    expect(get().app.today.extra).toBe(5);
  });

  it('«Я це знаю» і скасування відповіді', () => {
    const { get } = setup();
    get().saveBlock(1, new Set([1, 2, 3, 4, 5, 6]));
    get().startLearn();
    get().learnKnown();
    expect(get().app.words[1]?.s).toBe('known');
    const session = get().session;
    expect(session?.kind === 'learn' && session.s.pack).toEqual([2, 3, 4, 5, 6]);

    passIntros(get);
    const before = get().app;
    const rank = get().session?.s.queue[0]?.rank as number;
    get().answer(true);
    expect(get().app.words[rank]?.s).toBe('learning');
    get().undo();
    expect(get().app.words[rank]).toEqual(before.words[rank]);
    expect(get().app.today).toEqual(before.today);
    expect(get().app.history).toEqual(before.history);
    expect(get().session?.s.queue[0]?.rank).toBe(rank);

    get().undo();
    expect(get().app.words[1]?.s).toBe('queued');
    expect(get().undoStack).toHaveLength(0);
  });

  it('новий день о 04:00 скидає лічильник нових', () => {
    const { get, advance } = setup();
    get().saveBlock(1, new Set(blockRanks(1)));
    get().startLearn();
    passIntros(get);
    get().answer(true);
    expect(get().app.today.newDone).toBe(1);
    advance(17); // 03:00 наступного дня — ще той самий навчальний день
    get().answer(true);
    expect(get().app.today.newDone).toBe(2);
    advance(1); // 04:00
    get().answer(true);
    expect(get().app.today.newDone).toBe(1);
  });
});

describe('повторення', () => {
  it('«Забув» → етап 1 і вправа; вправа не змінює статус', () => {
    const { get, advance } = setup();
    get().saveBlock(1, new Set([1, 2]));
    get().startLearn();
    passIntros(get);
    get().answer(true);
    get().answer(true);
    get().endSession();

    advance(24);
    const day = dayNumber(new Date(START + 24 * HOUR));
    expect(get().startReview()).toBe(true);
    const first = get().session?.s.queue[0]?.rank as number;
    get().answer(false);
    expect(get().app.words[first]).toMatchObject({ s: 'learning', st: 1, due: day + 1, lapses: 1 });
    expect(get().app.history[day]).toEqual([0, 1, 1]);

    const second = get().session?.s.queue[0]?.rank as number;
    get().answer(true);
    expect(get().app.words[second]).toMatchObject({ s: 'learning', st: 2, due: day + 3 });

    // Вправа: той самий first, статус не змінюється.
    expect(get().session?.s.queue[0]).toMatchObject({ rank: first, attempt: 1 });
    get().answer(true);
    expect(get().app.words[first]).toMatchObject({ st: 1, lapses: 1 });
    expect(get().app.history[day]).toEqual([0, 2, 1]);
  });

  it('скасування повертає попередній етап', () => {
    const { get, advance } = setup();
    get().saveBlock(1, new Set([1]));
    get().startLearn();
    passIntros(get);
    get().answer(true);
    advance(24);
    get().startReview();
    const before = get().app.words[1];
    get().answer(true);
    expect(get().app.words[1]?.st).toBe(2);
    get().undo();
    expect(get().app.words[1]).toEqual(before);
    expect(get().session?.s.queue[0]?.rank).toBe(1);
  });
});

describe('ручні дії та скидання', () => {
  it('додати у вивчення / я це знаю / скинути', () => {
    const { get } = setup();
    get().setWord(500, 'queue');
    expect(get().app.words[500]).toMatchObject({ s: 'queued', q: START });
    get().setWord(500, 'known');
    expect(get().app.words[500]?.s).toBe('known');
    get().updateSettings({ dailyNew: 25 });
    get().resetProgress();
    expect(get().app.words).toEqual({});
    expect(get().app.settings.dailyNew).toBe(25);
    expect(get().app.resetAt).toBe(START);
  });
});

describe('migrate', () => {
  it('немає даних → null', () => {
    expect(migrate(undefined)).toBeNull();
  });

  it('доповнює налаштування значеннями за замовчуванням', () => {
    const raw = { v: 1, words: { 1: { s: 'known', u: 1 } }, settings: { dailyNew: 20 } };
    const state = migrate(raw);
    expect(state?.settings).toMatchObject({ dailyNew: 20, autoSpeak: true, theme: 'system' });
    expect(state?.v).toBe(SCHEMA_VERSION);
  });

  it('новіша версія або сміття → помилка, а не тихе перезаписування', () => {
    expect(() => migrate({ v: SCHEMA_VERSION + 1, words: {} })).toThrow();
    expect(() => migrate('oops')).toThrow();
    expect(() => migrate({ v: 1 })).toThrow();
  });
});
