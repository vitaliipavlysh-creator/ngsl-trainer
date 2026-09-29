import { dayNumber } from './dates';
import type { AppState, History, HistoryEntry, WordState, WordsMap } from './types';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Відбиток змісту стану (без `updatedAt`) — щоб зрозуміти, чи є що відправляти. */
export function fingerprint(state: AppState): string {
  return stableStringify({ ...state, updatedAt: undefined });
}

/** Новіший запис слова; за однакового часу — детерміновано, щоб злиття було симетричним. */
function newer(a: WordState, b: WordState): WordState {
  if (a.u !== b.u) return a.u > b.u ? a : b;
  return stableStringify(a) >= stableStringify(b) ? a : b;
}

const maxEntry = (a: HistoryEntry, b: HistoryEntry): HistoryEntry => [
  Math.max(a[0], b[0]),
  Math.max(a[1], b[1]),
  Math.max(a[2], b[2]),
];

/**
 * Зливає два стани (локальний і з іншого пристрою):
 * - слова — перемагає запис із новішим `u`; записи, старші за скидання прогресу, відкидаються;
 * - історія — максимум по кожному дню;
 * - налаштування — новіші за `settingsAt`;
 * - денні лічильники — за найпізніший день (у той самий день — максимум).
 */
export function mergeStates(a: AppState, b: AppState): AppState {
  const resetAt = Math.max(a.resetAt ?? 0, b.resetAt ?? 0);
  const resetDay = resetAt ? dayNumber(new Date(resetAt)) : -Infinity;
  const sides = [a, b].map((s) => ({ s, knowsReset: (s.resetAt ?? 0) === resetAt }));

  const words: WordsMap = {};
  for (const { s } of sides) {
    for (const [key, ws] of Object.entries(s.words)) {
      if (ws.u <= resetAt) continue;
      const rank = Number(key);
      const current = words[rank];
      words[rank] = current ? newer(current, ws) : ws;
    }
  }

  const history: History = {};
  for (const { s, knowsReset } of sides) {
    for (const [key, entry] of Object.entries(s.history)) {
      const day = Number(key);
      if (!knowsReset && day < resetDay) continue;
      const current = history[day];
      history[day] = current ? maxEntry(current, entry) : [...entry];
    }
  }

  const todays = sides.filter((x) => x.knowsReset).map((x) => x.s.today);
  const latestDay = Math.max(...todays.map((t) => t.day));
  const sameDay = todays.filter((t) => t.day === latestDay);
  const today = {
    day: latestDay,
    newDone: Math.max(...sameDay.map((t) => t.newDone)),
    extra: Math.max(...sameDay.map((t) => t.extra)),
  };

  const settingsFrom = (a.settingsAt ?? 0) >= (b.settingsAt ?? 0) ? a : b;
  const merged: AppState = {
    v: Math.max(a.v, b.v),
    words,
    settings: { ...settingsFrom.settings },
    history,
    today,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
  if (resetAt) merged.resetAt = resetAt;
  if (settingsFrom.settingsAt) merged.settingsAt = settingsFrom.settingsAt;
  return merged;
}
