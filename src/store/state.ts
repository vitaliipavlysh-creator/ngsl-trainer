import { dayNumber } from '../core/dates';
import type { AppState, Settings } from '../core/types';

export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  dailyNew: 15,
  autoSpeak: true,
  theme: 'system',
  controlReview: true,
};

/** Порожній стан. `updatedAt: 0` — будь-які збережені чи синхронізовані дані новіші. */
export function initialState(now = Date.now()): AppState {
  return {
    v: SCHEMA_VERSION,
    words: {},
    settings: { ...DEFAULT_SETTINGS },
    history: {},
    today: { day: dayNumber(new Date(now)), newDone: 0, extra: 0 },
    updatedAt: 0,
  };
}

/**
 * Приводить збережені дані до поточної схеми.
 * `null` — даних немає; помилка — дані є, але прочитати їх не можна (не перезаписуємо).
 */
export function migrate(raw: unknown): AppState | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object') throw new Error('Пошкоджені дані');
  const r = raw as Partial<AppState>;
  if (typeof r.v !== 'number' || r.v > SCHEMA_VERSION) {
    throw new Error('Дані збережені новішою версією застосунку — онови сторінку');
  }
  if (!r.words || typeof r.words !== 'object') throw new Error('Пошкоджені дані');
  const base = initialState();
  return {
    ...base,
    ...r,
    v: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS, ...r.settings },
    history: r.history ?? {},
    today: r.today ?? base.today,
    updatedAt: r.updatedAt ?? 0,
  };
}
