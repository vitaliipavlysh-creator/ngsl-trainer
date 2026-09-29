import { pluralN } from '../core/plural';

const percent = new Intl.NumberFormat('uk', { maximumFractionDigits: 1 });

/** 34,5 % */
export function formatPercent(value: number): string {
  return `${percent.format(value)} %`;
}

/** Безпечне читання localStorage (приватний режим, заблоковані дані). */
export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Не критично: це лише зручність.
  }
}

const MINUTE_FORMS = ['хвилину', 'хвилини', 'хвилин'] as const;
const timeFormat = new Intl.DateTimeFormat('uk', { hour: '2-digit', minute: '2-digit' });
const dateTimeFormat = new Intl.DateTimeFormat('uk', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** «щойно», «5 хвилин тому», «о 14:05», «3 жовт., 14:05». */
export function timeAgo(ms: number, now = Date.now()): string {
  const minutes = Math.floor((now - ms) / 60_000);
  if (minutes < 1) return 'щойно';
  if (minutes < 60) return `${pluralN(minutes, MINUTE_FORMS)} тому`;
  const date = new Date(ms);
  if (date.toDateString() === new Date(now).toDateString()) return `о ${timeFormat.format(date)}`;
  return dateTimeFormat.format(date);
}
