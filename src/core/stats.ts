import { BLOCK_COUNT, blockRanks } from './blocks';
import { TOTAL_WORDS } from './data';
import { isDue } from './scheduler';
import type { History, HistoryEntry, Settings, Status, Today, WordsMap } from './types';

export type StatusCounts = Record<Status, number>;

export const HISTORY_DAYS = 180;

/** Кількість слів за статусами — усіх або лише з `ranks`. */
export function statusCounts(words: WordsMap, ranks?: readonly number[]): StatusCounts {
  const counts: StatusCounts = { new: 0, known: 0, queued: 0, learning: 0, mastered: 0 };
  if (ranks) {
    for (const rank of ranks) counts[words[rank]?.s ?? 'new']++;
    return counts;
  }
  const stored = Object.values(words);
  for (const ws of stored) counts[ws.s]++;
  counts.new = TOTAL_WORDS - stored.length;
  return counts;
}

/** Відсоток слів `known + mastered` від усіх 2801. */
export function progressPercent(counts: StatusCounts): number {
  return ((counts.known + counts.mastered) / TOTAL_WORDS) * 100;
}

export function blockCounts(words: WordsMap, block: number): StatusCounts {
  return statusCounts(words, blockRanks(block));
}

/** Поточний блок — перший, де є невідсортовані слова; `null`, якщо все відсортовано. */
export function currentBlock(words: WordsMap): number | null {
  for (let b = 1; b <= BLOCK_COUNT; b++) {
    if (blockRanks(b).some((r) => !words[r])) return b;
  }
  return null;
}

export function dueCount(words: WordsMap, today: number): number {
  return Object.values(words).filter((ws) => isDue(ws, today)).length;
}

/** Повторення на `days` днів: [0] — сьогодні разом із простроченими. */
export function forecast(words: WordsMap, today: number, days = 7): number[] {
  const out = Array.from({ length: days }, () => 0);
  for (const ws of Object.values(words)) {
    if ((ws.s !== 'learning' && ws.s !== 'mastered') || ws.due === undefined) continue;
    const i = Math.max(0, ws.due - today);
    if (i < days) out[i] = (out[i] ?? 0) + 1;
  }
  return out;
}

/** Найближчий день із повтореннями після сьогодні. */
export function nextDue(words: WordsMap, today: number): { day: number; count: number } | null {
  let day = Infinity;
  let count = 0;
  for (const ws of Object.values(words)) {
    if ((ws.s !== 'learning' && ws.s !== 'mastered') || ws.due === undefined || ws.due <= today) {
      continue;
    }
    if (ws.due < day) [day, count] = [ws.due, 1];
    else if (ws.due === day) count++;
  }
  return count ? { day, count } : null;
}

const active = (e: HistoryEntry | undefined) => !!e && e[0] + e[1] > 0;

/** Дні поспіль з активністю, що закінчуються сьогодні або вчора. */
export function streak(history: History, today: number): number {
  let day = active(history[today]) ? today : today - 1;
  let n = 0;
  while (active(history[day])) {
    n++;
    day--;
  }
  return n;
}

/** Додає до лічильника дня й прибирає записи, старші за 180 днів. */
export function recordHistory(history: History, day: number, field: 0 | 1 | 2, delta = 1): History {
  const entry: HistoryEntry = [...(history[day] ?? [0, 0, 0])];
  entry[field] = Math.max(0, entry[field] + delta);
  const next: History = { [day]: entry };
  for (const [d, e] of Object.entries(history)) {
    if (Number(d) !== day && Number(d) > day - HISTORY_DAYS) next[Number(d)] = e;
  }
  return next;
}

/** Скидає денні лічильники, якщо настав новий день. */
export function rollToday(today: Today, day: number): Today {
  return today.day === day ? today : { day, newDone: 0, extra: 0 };
}

/** Скільки нових слів ще можна вивчити сьогодні. */
export function newLeft(today: Today, settings: Settings): number {
  return Math.max(0, settings.dailyNew + today.extra - today.newDone);
}
