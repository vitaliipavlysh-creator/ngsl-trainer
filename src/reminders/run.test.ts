import { describe, expect, it } from 'vitest';
import { dayNumberInZone } from '../core/dates';
import type { PushSub, ReminderFile } from '../core/reminder';
import { runReminders, type LoadedGist } from './run';

const AT_21 = new Date('2026-10-01T18:10:00Z'); // 21:10 у Києві
const today = dayNumberInZone(AT_21, 'Europe/Kyiv');
const sub = (n: number): PushSub => ({
  endpoint: `https://push/${n}`,
  keys: { p256dh: 'p', auth: 'a' },
});

function reminder(patch: Partial<ReminderFile> = {}): string {
  return JSON.stringify({
    v: 1,
    enabled: true,
    hour: 21,
    timeZone: 'Europe/Kyiv',
    subscriptions: [sub(1)],
    updatedAt: 0,
    ...patch,
  });
}

function progress(history: Record<number, [number, number, number]> = {}): string {
  return JSON.stringify({
    v: 1,
    words: { 7: { s: 'learning', st: 1, due: today, u: 1 } },
    settings: { dailyNew: 15, autoSpeak: true, theme: 'system', controlReview: true },
    history,
    today: { day: today, newDone: 0, extra: 0 },
    updatedAt: 1,
  });
}

function harness(gists: LoadedGist[], gone: string[] = []) {
  const sent: { endpoint: string; payload: string }[] = [];
  const writes: { id: string; name: string; content: string }[] = [];
  return {
    sent,
    writes,
    run: (force = false) =>
      runReminders({
        gists,
        now: AT_21,
        force,
        send: async (s, payload) => {
          if (gone.includes(s.endpoint))
            throw Object.assign(new Error('gone'), { statusCode: 410 });
          sent.push({ endpoint: s.endpoint, payload });
        },
        writeFile: async (id, name, content) => void writes.push({ id, name, content }),
      }),
  };
}

describe('runReminders', () => {
  it('Віталій — пуш, Анна вже займалась сьогодні — тиша', async () => {
    const h = harness([
      {
        id: 'v',
        files: {
          'ngsl-trainer-progress-vitalii.json': progress(),
          'ngsl-trainer-push-vitalii.json': reminder({ subscriptions: [sub(1), sub(2)] }),
        },
      },
      {
        id: 'a',
        files: {
          'ngsl-trainer-progress-anna.json': progress({ [today]: [3, 10, 0] }),
          'ngsl-trainer-push-anna.json': reminder({ subscriptions: [sub(3)] }),
        },
      },
      { id: 'other', files: { 'notes.md': 'hello' } },
    ]);
    expect(await h.run()).toEqual({ sent: 2, removed: 0 });
    expect(h.sent.map((s) => s.endpoint)).toEqual(['https://push/1', 'https://push/2']);
    expect(JSON.parse(h.sent[0]?.payload ?? '{}').body).toMatch(/1 слово на повторення/);
    expect(h.writes).toEqual([]);
  });

  it('прострочені підписки прибираються з файлу', async () => {
    const h = harness(
      [
        {
          id: 'v',
          files: {
            'ngsl-trainer-progress-vitalii.json': progress(),
            'ngsl-trainer-push-vitalii.json': reminder({ subscriptions: [sub(1), sub(2)] }),
          },
        },
      ],
      ['https://push/1'],
    );
    expect(await h.run()).toEqual({ sent: 1, removed: 1 });
    const saved = JSON.parse(h.writes[0]?.content ?? '{}') as ReminderFile;
    expect(saved.subscriptions.map((s) => s.endpoint)).toEqual(['https://push/2']);
  });

  it('force — тестове надсилання в будь-яку годину', async () => {
    const h = harness([
      { id: 'v', files: { 'ngsl-trainer-push-vitalii.json': reminder({ hour: 8 }) } },
    ]);
    expect((await h.run()).sent).toBe(0);
    expect((await h.run(true)).sent).toBe(1);
  });
});
