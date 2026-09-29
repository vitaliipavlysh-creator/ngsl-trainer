import type { Direction, Stage, WordState, WordsMap } from './types';

/** Інтервал (днів) після успішного повторення на етапі 1–3. Етап 4 → `mastered`. */
export const STAGE_INTERVALS: Record<1 | 2 | 3, number> = { 1: 3, 2: 7, 3: 21 };
/** Контрольне повторення вивченого слова. */
export const CONTROL_INTERVAL = 60;
/** З такої кількості «Забув» слово вважається важким. */
export const LEECH_LAPSES = 4;

function carry(prev: WordState | undefined): Pick<WordState, 'lapses'> {
  return prev?.lapses ? { lapses: prev.lapses } : {};
}

export function isLocked(ws: WordState | undefined): boolean {
  return ws?.s === 'learning' || ws?.s === 'mastered';
}

export function isLeech(ws: WordState | undefined): boolean {
  return (ws?.lapses ?? 0) >= LEECH_LAPSES;
}

/** «Я це знаю». */
export function markKnown(prev: WordState | undefined, now: number): WordState {
  return { s: 'known', ...carry(prev), u: now };
}

/** У чергу на вивчення. `manual` — додано вручну, вчиться першим. */
export function enqueue(prev: WordState | undefined, now: number, manual = false): WordState {
  return { s: 'queued', ...(manual ? { q: now } : {}), ...carry(prev), u: now };
}

/** «Згадав» у перевірці нового слова. */
export function startLearning(prev: WordState | undefined, today: number, now: number): WordState {
  return { s: 'learning', st: 1, due: today + 1, ...carry(prev), u: now };
}

/** Відповідь у повторенні: етап 1→2→3→4→`mastered`, «Забув» → етап 1. */
export function answerReview(
  prev: WordState,
  remembered: boolean,
  today: number,
  now: number,
  controlReview: boolean,
): WordState {
  if (!remembered) {
    return { s: 'learning', st: 1, due: today + 1, lapses: (prev.lapses ?? 0) + 1, u: now };
  }
  if (prev.s === 'learning' && (prev.st ?? 1) < 4) {
    const st = (prev.st ?? 1) as 1 | 2 | 3;
    return {
      s: 'learning',
      st: (st + 1) as Stage,
      due: today + STAGE_INTERVALS[st],
      ...carry(prev),
      u: now,
    };
  }
  if (prev.s === 'learning') {
    return {
      s: 'mastered',
      ...(controlReview ? { due: today + CONTROL_INTERVAL } : {}),
      ...carry(prev),
      u: now,
    };
  }
  // Контрольне повторення вивченого слова пройдено — більше не показуємо.
  return { s: 'mastered', ...carry(prev), u: now };
}

/** Етапи 1–2: EN→UA (впізнати). Етапи 3–4 і контроль: UA→EN (згадати слово). */
export function reviewDirection(ws: WordState): Direction {
  return ws.s === 'learning' && (ws.st ?? 1) <= 2 ? 'en-ua' : 'ua-en';
}

export function isDue(ws: WordState, today: number): boolean {
  return (ws.s === 'learning' || ws.s === 'mastered') && ws.due !== undefined && ws.due <= today;
}

/**
 * Зберегти блок у сортуванні: позначені → `queued`, решта → `known`.
 * `learning` / `mastered` не змінюються; незмінені записи зберігають свій `u`.
 */
export function sortBlock(
  words: WordsMap,
  ranks: readonly number[],
  unknown: ReadonlySet<number>,
  now: number,
): WordsMap {
  const next = { ...words };
  for (const rank of ranks) {
    const prev = words[rank];
    if (isLocked(prev)) continue;
    const want = unknown.has(rank) ? 'queued' : 'known';
    if (prev?.s === want) continue;
    next[rank] = want === 'queued' ? enqueue(prev, now) : markKnown(prev, now);
  }
  return next;
}

/** Черга нових слів: спершу додані вручну (за часом), далі за рангом. */
export function queuedOrder(words: WordsMap): number[] {
  return Object.entries(words)
    .filter(([, ws]) => ws.s === 'queued')
    .map(([rank, ws]) => ({ rank: Number(rank), q: ws.q }))
    .sort((a, b) => {
      if (a.q !== undefined && b.q !== undefined) return a.q - b.q || a.rank - b.rank;
      if (a.q !== undefined) return -1;
      if (b.q !== undefined) return 1;
      return a.rank - b.rank;
    })
    .map((x) => x.rank);
}

/** Слова до повторення: спершу найбільш прострочені, далі за рангом. */
export function dueOrder(words: WordsMap, today: number): number[] {
  return Object.entries(words)
    .filter(([, ws]) => isDue(ws, today))
    .map(([rank, ws]) => ({ rank: Number(rank), due: ws.due as number }))
    .sort((a, b) => a.due - b.due || a.rank - b.rank)
    .map((x) => x.rank);
}
