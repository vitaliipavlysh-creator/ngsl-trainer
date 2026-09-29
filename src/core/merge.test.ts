import { describe, expect, it } from 'vitest';
import { dayNumber } from './dates';
import { fingerprint, mergeStates } from './merge';
import type { AppState } from './types';

const DAY = 20_000;

function state(patch: Partial<AppState> = {}): AppState {
  return {
    v: 1,
    words: {},
    settings: { dailyNew: 15, autoSpeak: true, theme: 'system', controlReview: true },
    history: {},
    today: { day: DAY, newDone: 0, extra: 0 },
    updatedAt: 0,
    ...patch,
  };
}

const phone = state({
  words: {
    1: { s: 'known', u: 100 },
    2: { s: 'learning', st: 2, due: DAY + 3, u: 300 },
    3: { s: 'queued', u: 50 },
  },
  history: { [DAY - 1]: [5, 10, 1], [DAY]: [3, 4, 0] },
  today: { day: DAY, newDone: 3, extra: 0 },
  updatedAt: 300,
});

const pc = state({
  words: {
    2: { s: 'learning', st: 1, due: DAY + 1, u: 200 },
    3: { s: 'learning', st: 1, due: DAY + 1, u: 250 },
    4: { s: 'known', u: 150 },
  },
  history: { [DAY]: [5, 2, 1], [DAY - 2]: [1, 1, 0] },
  today: { day: DAY, newDone: 5, extra: 5 },
  settings: { dailyNew: 20, autoSpeak: false, theme: 'dark', controlReview: true },
  settingsAt: 120,
  updatedAt: 250,
});

describe('mergeStates', () => {
  it('слова: обʼєднання, новіший запис перемагає', () => {
    const m = mergeStates(phone, pc);
    expect(m.words).toEqual({
      1: phone.words[1],
      2: phone.words[2],
      3: pc.words[3],
      4: pc.words[4],
    });
    expect(m.updatedAt).toBe(300);
  });

  it('історія — максимум по днях, лічильники дня — максимум', () => {
    const m = mergeStates(phone, pc);
    expect(m.history).toEqual({ [DAY - 2]: [1, 1, 0], [DAY - 1]: [5, 10, 1], [DAY]: [5, 4, 1] });
    expect(m.today).toEqual({ day: DAY, newDone: 5, extra: 5 });
  });

  it('денні лічильники беруться з найпізнішого дня', () => {
    const later = { ...pc, today: { day: DAY + 1, newDone: 1, extra: 0 } };
    expect(mergeStates(phone, later).today).toEqual({ day: DAY + 1, newDone: 1, extra: 0 });
  });

  it('налаштування — новіші за settingsAt', () => {
    expect(mergeStates(phone, pc).settings.theme).toBe('dark');
    const changed = {
      ...phone,
      settings: { ...phone.settings, dailyNew: 10 as const },
      settingsAt: 500,
    };
    expect(mergeStates(changed, pc).settings.dailyNew).toBe(10);
  });

  it('симетричне й ідемпотентне', () => {
    const ab = mergeStates(phone, pc);
    const ba = mergeStates(pc, phone);
    expect(fingerprint(ab)).toBe(fingerprint(ba));
    expect(fingerprint(mergeStates(ab, pc))).toBe(fingerprint(ab));
    expect(fingerprint(mergeStates(ab, ab))).toBe(fingerprint(ab));
  });

  it('скидання прогресу не повертається з іншого пристрою', () => {
    const resetAt = new Date(2026, 9, 1, 12).getTime();
    const resetDay = dayNumber(new Date(resetAt));
    const old = state({
      words: { 1: { s: 'known', u: resetAt - 1000 }, 2: { s: 'known', u: resetAt + 1000 } },
      history: { [resetDay - 1]: [9, 9, 9], [resetDay]: [1, 0, 0] },
      today: { day: resetDay, newDone: 9, extra: 0 },
      updatedAt: resetAt + 1000,
    });
    const reset = state({
      words: { 5: { s: 'queued', u: resetAt + 10 } },
      today: { day: resetDay, newDone: 0, extra: 0 },
      resetAt,
      updatedAt: resetAt + 10,
    });
    const m = mergeStates(old, reset);
    expect(Object.keys(m.words).map(Number).sort()).toEqual([2, 5]);
    expect(m.history).toEqual({ [resetDay]: [1, 0, 0] });
    expect(m.today.newDone).toBe(0);
    expect(m.resetAt).toBe(resetAt);
  });

  it('fingerprint не залежить від порядку ключів і updatedAt', () => {
    const a = state({ words: { 1: { s: 'known', u: 1 }, 2: { s: 'queued', u: 2 } }, updatedAt: 1 });
    const b = state({ words: { 2: { u: 2, s: 'queued' }, 1: { u: 1, s: 'known' } }, updatedAt: 9 });
    expect(fingerprint(a)).toBe(fingerprint(b));
  });
});
