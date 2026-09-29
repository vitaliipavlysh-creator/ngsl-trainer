import { dayNumberInZone, hourInZone } from './dates';
import { pluralN, WORD_FORMS } from './plural';
import { dueCount } from './stats';
import type { AppState } from './types';

/** Підписка браузера на пуші (як `PushSubscription.toJSON()`). */
export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Налаштування нагадувань профілю — окремий файл у Gist профілю. */
export interface ReminderFile {
  v: 1;
  enabled: boolean;
  /** Година нагадування (0–23) у `timeZone`. */
  hour: number;
  timeZone: string;
  subscriptions: PushSub[];
  updatedAt: number;
}

export const DEFAULT_REMINDER_HOUR = 21;

export interface ReminderMessage {
  title: string;
  body: string;
  url: string;
}

/** Додає або прибирає підписку пристрою; інші пристрої профілю лишаються. */
export function withSubscription(
  file: ReminderFile | null,
  sub: PushSub,
  on: boolean,
  patch: { hour: number; timeZone: string; now: number },
): ReminderFile {
  const others = (file?.subscriptions ?? []).filter((s) => s.endpoint !== sub.endpoint);
  const subscriptions = on ? [...others, sub] : others;
  return {
    v: 1,
    enabled: subscriptions.length > 0,
    hour: patch.hour,
    timeZone: patch.timeZone,
    subscriptions,
    updatedAt: patch.now,
  };
}

/**
 * Чи надсилати нагадування зараз і з яким текстом.
 * Не турбуємо, якщо не та година або сьогодні вже займались (день — з 04:00 у поясі профілю).
 */
export function planReminder(
  file: ReminderFile,
  progress: AppState | null,
  now: Date,
  force = false,
): ReminderMessage | null {
  if (!file.enabled || file.subscriptions.length === 0) return null;
  if (!force && hourInZone(now, file.timeZone) !== file.hour) return null;

  const today = dayNumberInZone(now, file.timeZone);
  const done = progress?.history[today];
  if (!force && done && done[0] + done[1] > 0) return null;

  const words = progress?.words ?? {};
  const due = dueCount(words, today);
  const queued = Object.values(words).some((w) => w.s === 'queued');
  const body =
    due > 0
      ? `Сьогодні ${pluralN(due, WORD_FORMS)} на повторення — це кілька хвилин.`
      : queued
        ? 'Повторень немає — саме час для нових слів.'
        : 'Черга порожня — відсортуй наступний блок слів.';
  return { title: 'Час для англійської', body, url: './#/' };
}
