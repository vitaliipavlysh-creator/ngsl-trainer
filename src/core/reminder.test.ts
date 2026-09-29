import { describe, expect, it } from 'vitest';
import { dayNumber, dayNumberInZone, hourInZone } from './dates';
import { planReminder, withSubscription, type PushSub, type ReminderFile } from './reminder';
import type { AppState } from './types';

const sub = (n: number): PushSub => ({
  endpoint: `https://push/${n}`,
  keys: { p256dh: 'p', auth: 'a' },
});
const file = (patch: Partial<ReminderFile> = {}): ReminderFile => ({
  v: 1,
  enabled: true,
  hour: 21,
  timeZone: 'Europe/Kyiv',
  subscriptions: [sub(1)],
  updatedAt: 0,
  ...patch,
});
// 21:10 за Києвом 1 жовтня 2026 (UTC+3) = 18:10 UTC.
const AT_21 = new Date('2026-10-01T18:10:00Z');
const today = dayNumberInZone(AT_21, 'Europe/Kyiv');

function progress(patch: Partial<AppState> = {}): AppState {
  return {
    v: 1,
    words: {},
    settings: { dailyNew: 15, autoSpeak: true, theme: 'system', controlReview: true },
    history: {},
    today: { day: today, newDone: 0, extra: 0 },
    updatedAt: 0,
    ...patch,
  };
}

describe('часовий пояс', () => {
  it('година й день у поясі профілю, межа о 04:00', () => {
    expect(hourInZone(AT_21, 'Europe/Kyiv')).toBe(21);
    expect(hourInZone(AT_21, 'America/New_York')).toBe(14);
    const kyiv0330 = new Date('2026-10-02T00:30:00Z'); // 03:30 наступного дня
    expect(dayNumberInZone(kyiv0330, 'Europe/Kyiv')).toBe(today);
    expect(dayNumberInZone(new Date('2026-10-02T01:00:00Z'), 'Europe/Kyiv')).toBe(today + 1);
  });

  it('збігається з dayNumber для локального поясу', () => {
    const d = new Date(2026, 9, 1, 12);
    expect(dayNumberInZone(d, 'Europe/Kyiv')).toBe(dayNumber(d));
  });
});

describe('planReminder', () => {
  it('у свою годину — з кількістю повторень', () => {
    const p = progress({
      words: {
        1: { s: 'learning', st: 1, due: today, u: 0 },
        2: { s: 'learning', st: 2, due: today - 2, u: 0 },
        3: { s: 'learning', st: 2, due: today + 3, u: 0 },
      },
    });
    expect(planReminder(file(), p, AT_21)?.body).toMatch(/^Сьогодні 2 слова на повторення/);
  });

  it('не та година, вимкнено або без підписок — нічого', () => {
    expect(planReminder(file({ hour: 9 }), progress(), AT_21)).toBeNull();
    expect(planReminder(file({ enabled: false }), progress(), AT_21)).toBeNull();
    expect(planReminder(file({ subscriptions: [] }), progress(), AT_21)).toBeNull();
  });

  it('сьогодні вже займався — не турбуємо (крім тестового надсилання)', () => {
    const p = progress({ history: { [today]: [0, 5, 1] } });
    expect(planReminder(file(), p, AT_21)).toBeNull();
    expect(planReminder(file({ hour: 3 }), p, AT_21, true)).not.toBeNull();
  });

  it('текст без повторень: нові слова або сортування', () => {
    expect(
      planReminder(file(), progress({ words: { 5: { s: 'queued', u: 0 } } }), AT_21)?.body,
    ).toMatch(/нових слів/);
    expect(planReminder(file(), progress(), AT_21)?.body).toMatch(/відсортуй/);
    expect(planReminder(file(), null, AT_21)?.body).toMatch(/відсортуй/);
  });
});

describe('withSubscription', () => {
  it('кілька пристроїв без дублікатів; вимкнення прибирає лише свій', () => {
    const opts = { hour: 21, timeZone: 'Europe/Kyiv', now: 1 };
    let f = withSubscription(null, sub(1), true, opts);
    f = withSubscription(f, sub(2), true, opts);
    f = withSubscription(f, sub(1), true, { ...opts, hour: 20 });
    expect(f.subscriptions.map((s) => s.endpoint).sort()).toEqual([
      'https://push/1',
      'https://push/2',
    ]);
    expect(f.hour).toBe(20);
    f = withSubscription(f, sub(1), false, opts);
    expect(f.subscriptions.map((s) => s.endpoint)).toEqual(['https://push/2']);
    expect(f.enabled).toBe(true);
    f = withSubscription(f, sub(2), false, opts);
    expect(f.enabled).toBe(false);
  });
});
