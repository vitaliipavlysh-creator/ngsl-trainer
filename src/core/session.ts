import type { Direction } from './types';

export type Rng = () => number;

export const PACK_SIZE = 5;
/** «Забув» → картка повертається через стільки позицій. */
export const REINSERT_GAP = 4;
export const ROUND_SIZE = 30;
/** Скільки разів показати забуте слово як вправу в сесії повторення. */
export const MAX_PRACTICE = 3;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** Вставляє картку через `REINSERT_GAP` позицій або в кінець, якщо карток менше. */
function reinsert<T>(queue: readonly T[], item: T): T[] {
  const at = Math.min(REINSERT_GAP, queue.length);
  return [...queue.slice(0, at), item, ...queue.slice(at)];
}

// ── Вивчення нових ───────────────────────────────────────────────

export interface LearnCard {
  rank: number;
  kind: 'intro' | 'check';
}

export interface LearnSession {
  /** Слова з черги, ще не взяті в пачки. */
  candidates: number[];
  /** Скільки ще слів можна взяти (залишок денного ліміту). */
  remaining: number;
  pack: number[];
  /** Картки поточної пачки; `queue[0]` — на екрані. */
  queue: LearnCard[];
  learned: number[];
  knownMarked: number[];
  forgot: number;
}

function fillPack(s: LearnSession, rng: Rng): LearnSession {
  if (s.queue.length > 0) return s;
  const n = Math.min(PACK_SIZE, s.remaining, s.candidates.length);
  const pack = s.candidates.slice(0, n);
  return {
    ...s,
    candidates: s.candidates.slice(n),
    remaining: s.remaining - n,
    pack,
    queue: [
      ...pack.map((rank): LearnCard => ({ rank, kind: 'intro' })),
      ...shuffle(pack, rng).map((rank): LearnCard => ({ rank, kind: 'check' })),
    ],
  };
}

export function createLearnSession(
  queued: readonly number[],
  limit: number,
  rng: Rng = Math.random,
): LearnSession {
  const empty: LearnSession = {
    candidates: [...queued],
    remaining: Math.max(0, limit),
    pack: [],
    queue: [],
    learned: [],
    knownMarked: [],
    forgot: 0,
  };
  return fillPack(empty, rng);
}

/** «Далі» на картці-знайомстві. */
export function learnNext(s: LearnSession, rng: Rng = Math.random): LearnSession {
  if (s.queue[0]?.kind !== 'intro') return s;
  return fillPack({ ...s, queue: s.queue.slice(1) }, rng);
}

/** «Я це знаю» на картці-знайомстві: слово виходить із пачки, його місце займає наступне з черги. */
export function learnMarkKnown(s: LearnSession, rng: Rng = Math.random): LearnSession {
  const card = s.queue[0];
  if (card?.kind !== 'intro') return s;
  const rest = s.queue.slice(1).filter((c) => c.rank !== card.rank);
  let pack = s.pack.filter((r) => r !== card.rank);
  let queue = rest;
  const [next, ...candidates] = s.candidates;
  if (next !== undefined) {
    pack = [...pack, next];
    const intros = rest.filter((c) => c.kind === 'intro');
    const checks = rest.filter((c) => c.kind === 'check');
    checks.splice(Math.floor(rng() * (checks.length + 1)), 0, { rank: next, kind: 'check' });
    queue = [...intros, { rank: next, kind: 'intro' }, ...checks];
  }
  return fillPack(
    {
      ...s,
      pack,
      queue,
      candidates: next === undefined ? s.candidates : candidates,
      knownMarked: [...s.knownMarked, card.rank],
    },
    rng,
  );
}

/** Відповідь у перевірці: «Згадав» → слово вивчене, «Забув» → картка повернеться. */
export function learnAnswer(
  s: LearnSession,
  remembered: boolean,
  rng: Rng = Math.random,
): LearnSession {
  const card = s.queue[0];
  if (card?.kind !== 'check') return s;
  const rest = s.queue.slice(1);
  if (remembered) return fillPack({ ...s, queue: rest, learned: [...s.learned, card.rank] }, rng);
  return { ...s, queue: reinsert(rest, card), forgot: s.forgot + 1 };
}

export function learnProgress(s: LearnSession): { done: number; total: number } {
  const done = s.learned.length;
  const inPack = s.pack.filter((r) => !s.learned.includes(r)).length;
  return { done, total: done + inPack + Math.min(s.remaining, s.candidates.length) };
}

// ── Повторення ───────────────────────────────────────────────────

export interface ReviewCard {
  rank: number;
  dir: Direction;
  /** 0 — оцінювана відповідь; 1–3 — вправа після «Забув» (статус не змінює). */
  attempt: number;
}

export interface ReviewTally {
  remembered: number;
  forgot: number;
}

export interface ReviewSession {
  /** Картки, що ще не потрапили в раунд. */
  pending: ReviewCard[];
  queue: ReviewCard[];
  roundSize: number;
  round: ReviewTally;
  total: ReviewTally;
}

const ZERO: ReviewTally = { remembered: 0, forgot: 0 };

export function startRound(s: ReviewSession): ReviewSession {
  const n = Math.min(s.roundSize, s.pending.length);
  return { ...s, queue: s.pending.slice(0, n), pending: s.pending.slice(n), round: ZERO };
}

export function createReviewSession(
  cards: readonly { rank: number; dir: Direction }[],
  roundSize = ROUND_SIZE,
): ReviewSession {
  return startRound({
    pending: cards.map((c) => ({ ...c, attempt: 0 })),
    queue: [],
    roundSize,
    round: ZERO,
    total: ZERO,
  });
}

export function reviewAnswer(s: ReviewSession, remembered: boolean): ReviewSession {
  const card = s.queue[0];
  if (!card) return s;
  let queue = s.queue.slice(1);
  if (!remembered && card.attempt < MAX_PRACTICE) {
    queue = reinsert(queue, { ...card, attempt: card.attempt + 1 });
  }
  if (card.attempt > 0) return { ...s, queue };
  const key = remembered ? 'remembered' : 'forgot';
  return {
    ...s,
    queue,
    round: { ...s.round, [key]: s.round[key] + 1 },
    total: { ...s.total, [key]: s.total[key] + 1 },
  };
}

export function reviewProgress(s: ReviewSession): { done: number; total: number } {
  const done = s.round.remembered + s.round.forgot;
  return { done, total: done + s.queue.filter((c) => c.attempt === 0).length };
}
