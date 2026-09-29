import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { blockRanks } from '../core/blocks';
import { dayNumber } from '../core/dates';
import { mergeStates } from '../core/merge';
import {
  answerReview,
  dueOrder,
  enqueue,
  markKnown,
  queuedOrder,
  reviewDirection,
  sortBlock,
  startLearning,
} from '../core/scheduler';
import {
  createLearnSession,
  createReviewSession,
  learnAnswer,
  learnMarkKnown,
  learnNext,
  reviewAnswer,
  startRound,
  type LearnSession,
  type ReviewSession,
  type Rng,
} from '../core/session';
import { newLeft, recordHistory, rollToday } from '../core/stats';
import type { AppState, History, Settings, Today, WordState, WordsMap } from '../core/types';
import { initialState } from './state';

/** Скільки слів додає «Ще 5 слів». */
export const EXTRA_NEW = 5;
const UNDO_LIMIT = 50;

export type ActiveSession =
  | { kind: 'learn'; s: LearnSession; revealed: boolean; step: number }
  | { kind: 'review'; s: ReviewSession; revealed: boolean; step: number };

interface UndoEntry {
  session: ActiveSession;
  words: [rank: number, prev: WordState | undefined][];
  today: Today;
  history: History;
}

export type WordAction = 'known' | 'queue';

export interface Store {
  hydrated: boolean;
  app: AppState;
  session: ActiveSession | null;
  undoStack: UndoEntry[];
  clock: () => number;
  rng: Rng;

  hydrate(app: AppState): void;
  saveBlock(block: number, unknown: ReadonlySet<number>): void;
  setWord(rank: number, action: WordAction): void;
  updateSettings(patch: Partial<Settings>): void;
  resetProgress(): void;
  /** Відновлення з файлу: об'єднати з поточним прогресом або замінити його. */
  importState(imported: AppState, mode: 'merge' | 'replace'): void;

  /** Повертає `false`, якщо вчити нічого (черга порожня або ліміт вичерпано). */
  startLearn(extra?: boolean): boolean;
  /** Повертає `false`, якщо повторювати нічого. */
  startReview(): boolean;
  reveal(): void;
  learnNext(): void;
  learnKnown(): void;
  answer(remembered: boolean): void;
  nextRound(): void;
  undo(): void;
  endSession(): void;
}

export function createAppStore(opts: { clock?: () => number; rng?: Rng } = {}) {
  return createStore<Store>()((set, get) => {
    const ctx = () => {
      const now = get().clock();
      return { now, day: dayNumber(new Date(now)) };
    };

    const pushUndo = (ranks: number[]) => {
      const { session, app, undoStack } = get();
      if (!session) return undoStack;
      const entry: UndoEntry = {
        session,
        words: ranks.map((r) => [r, app.words[r]]),
        today: app.today,
        history: app.history,
      };
      return [...undoStack.slice(-(UNDO_LIMIT - 1)), entry];
    };

    const nextSession = (session: ActiveSession, s: LearnSession | ReviewSession) =>
      ({ ...session, s, revealed: false, step: session.step + 1 }) as ActiveSession;

    return {
      hydrated: false,
      app: initialState(),
      session: null,
      undoStack: [],
      clock: opts.clock ?? (() => Date.now()),
      rng: opts.rng ?? Math.random,

      hydrate(app) {
        set({ app, hydrated: true });
      },

      saveBlock(block, unknown) {
        const { now } = ctx();
        const { app } = get();
        const words = sortBlock(app.words, blockRanks(block), unknown, now);
        set({ app: { ...app, words, updatedAt: now } });
      },

      setWord(rank, action) {
        const { now } = ctx();
        const { app } = get();
        const prev = app.words[rank];
        const next = action === 'known' ? markKnown(prev, now) : enqueue(prev, now, true);
        set({ app: { ...app, words: { ...app.words, [rank]: next }, updatedAt: now } });
      },

      updateSettings(patch) {
        const { now } = ctx();
        const { app } = get();
        set({
          app: {
            ...app,
            settings: { ...app.settings, ...patch },
            settingsAt: now,
            updatedAt: now,
          },
        });
      },

      importState(imported, mode) {
        const { now } = ctx();
        const { app } = get();
        if (mode === 'merge') {
          set({ app: { ...mergeStates(app, imported), updatedAt: now } });
          return;
        }
        // «Замінити»: імпортовані записи стають найновішими, а все старіше — скинутим,
        // щоб синхронізація не повернула попередній прогрес.
        const words: WordsMap = {};
        for (const [rank, ws] of Object.entries(imported.words))
          words[Number(rank)] = { ...ws, u: now };
        set({
          app: { ...imported, words, resetAt: now - 1, settingsAt: now, updatedAt: now },
          session: null,
          undoStack: [],
        });
      },

      resetProgress() {
        const { now } = ctx();
        const { app } = get();
        set({
          app: { ...initialState(now), settings: app.settings, resetAt: now, updatedAt: now },
          session: null,
          undoStack: [],
        });
      },

      startLearn(extra = false) {
        const { now, day } = ctx();
        const { app, rng } = get();
        let today = rollToday(app.today, day);
        if (extra) today = { ...today, extra: today.extra + EXTRA_NEW };
        const s = createLearnSession(queuedOrder(app.words), newLeft(today, app.settings), rng);
        set({
          app: today === app.today ? app : { ...app, today, updatedAt: now },
          session: { kind: 'learn', s, revealed: false, step: 0 },
          undoStack: [],
        });
        return s.queue.length > 0;
      },

      startReview() {
        const { day } = ctx();
        const { app } = get();
        const cards = dueOrder(app.words, day).map((rank) => ({
          rank,
          dir: reviewDirection(app.words[rank] as WordState),
        }));
        const s = createReviewSession(cards);
        set({ session: { kind: 'review', s, revealed: false, step: 0 }, undoStack: [] });
        return s.queue.length > 0;
      },

      reveal() {
        const { session } = get();
        if (session && !session.revealed) set({ session: { ...session, revealed: true } });
      },

      learnNext() {
        const { session, rng } = get();
        if (session?.kind !== 'learn') return;
        set({ session: nextSession(session, learnNext(session.s, rng)) });
      },

      learnKnown() {
        const { session, app, rng } = get();
        const card = session?.kind === 'learn' ? session.s.queue[0] : undefined;
        if (session?.kind !== 'learn' || card?.kind !== 'intro') return;
        const { now } = ctx();
        const undoStack = pushUndo([card.rank]);
        set({
          app: {
            ...app,
            words: { ...app.words, [card.rank]: markKnown(app.words[card.rank], now) },
            updatedAt: now,
          },
          session: nextSession(session, learnMarkKnown(session.s, rng)),
          undoStack,
        });
      },

      answer(remembered) {
        const { session, app, rng } = get();
        if (!session) return;
        const { now, day } = ctx();
        let { words, history } = app;
        let today = rollToday(app.today, day);

        if (session.kind === 'learn') {
          const card = session.s.queue[0];
          if (card?.kind !== 'check') return;
          const undoStack = pushUndo([card.rank]);
          if (remembered) {
            words = { ...words, [card.rank]: startLearning(words[card.rank], day, now) };
            today = { ...today, newDone: today.newDone + 1 };
            history = recordHistory(history, day, 0);
          }
          set({
            app: { ...app, words, today, history, updatedAt: now },
            session: nextSession(session, learnAnswer(session.s, remembered, rng)),
            undoStack,
          });
          return;
        }

        const card = session.s.queue[0];
        if (!card) return;
        const undoStack = pushUndo([card.rank]);
        const prev = words[card.rank];
        if (card.attempt === 0 && prev) {
          words = {
            ...words,
            [card.rank]: answerReview(prev, remembered, day, now, app.settings.controlReview),
          };
          history = recordHistory(history, day, 1);
          if (!remembered) history = recordHistory(history, day, 2);
        }
        set({
          app: { ...app, words, today, history, updatedAt: now },
          session: nextSession(session, reviewAnswer(session.s, remembered)),
          undoStack,
        });
      },

      nextRound() {
        const { session } = get();
        if (session?.kind !== 'review') return;
        set({ session: nextSession(session, startRound(session.s)), undoStack: [] });
      },

      undo() {
        const { undoStack, app, session } = get();
        const entry = undoStack.at(-1);
        if (!entry || !session) return;
        const { now } = ctx();
        const words = { ...app.words };
        for (const [rank, prev] of entry.words) {
          // Новий `u`: інакше синхронізація повернула б скасовану відповідь з іншого пристрою.
          if (prev) words[rank] = { ...prev, u: now };
          else delete words[rank];
        }
        set({
          app: { ...app, words, today: entry.today, history: entry.history, updatedAt: now },
          session: { ...entry.session, revealed: false, step: session.step + 1 },
          undoStack: undoStack.slice(0, -1),
        });
      },

      endSession() {
        set({ session: null, undoStack: [] });
      },
    };
  });
}

export type AppStore = ReturnType<typeof createAppStore>;

export const appStore = createAppStore();

export function useApp<T>(selector: (s: Store) => T): T {
  return useStore(appStore, selector);
}
