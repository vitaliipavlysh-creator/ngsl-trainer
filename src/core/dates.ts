/** Новий навчальний день починається о 04:00 за локальним часом. */
export const DAY_START_HOUR = 4;
const MS_PER_DAY = 86_400_000;

/** Номер навчального дня: кількість локальних календарних днів від 1970-01-01. */
export function dayNumber(date: Date = new Date(), startHour = DAY_START_HOUR): number {
  const shift = date.getHours() < startHour ? 1 : 0;
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() - shift);
  return Math.round(utc / MS_PER_DAY);
}

/** Локальна дата (опівночі) для номера дня. */
export function dayToDate(day: number): Date {
  const utc = new Date(day * MS_PER_DAY);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

const dayFormat = new Intl.DateTimeFormat('uk', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** «сьогодні», «завтра» або «пт, 3 жовт.». */
export function dayLabel(day: number, today: number): string {
  if (day <= today) return 'сьогодні';
  if (day === today + 1) return 'завтра';
  return dayFormat.format(dayToDate(day));
}

/** Номер навчального дня в заданому часовому поясі (для нагадувань, що рахуються на сервері). */
export function dayNumberInZone(date: Date, timeZone: string, startHour = DAY_START_HOUR): number {
  const { y, m, d, h } = zonedParts(date, timeZone);
  return Math.round(Date.UTC(y, m - 1, d - (h < startHour ? 1 : 0)) / MS_PER_DAY);
}

/** Година (0–23) у заданому часовому поясі. */
export function hourInZone(date: Date, timeZone: string): number {
  return zonedParts(date, timeZone).h;
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') };
}
