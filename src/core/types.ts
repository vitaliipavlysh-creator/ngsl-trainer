/** Статус слова. `new` не зберігається: слово без запису вважається новим. */
export type Status = 'new' | 'known' | 'queued' | 'learning' | 'mastered';
export type StoredStatus = Exclude<Status, 'new'>;
export type Stage = 1 | 2 | 3 | 4;

export interface WordState {
  s: StoredStatus;
  /** Етап для `learning`. */
  st?: Stage;
  /** Номер дня наступного повторення (див. `dates.ts`). */
  due?: number;
  /** Скільки разів «Забув» у повтореннях. */
  lapses?: number;
  /** Час ручного додавання в чергу, мс — такі слова вчаться першими. */
  q?: number;
  /** updatedAt запису, мс — для злиття при синхронізації. */
  u: number;
}

/** rank → запис; лише слова, що не `new`. */
export type WordsMap = Record<number, WordState>;

/** Напрямок картки: показуємо англійське слово або переклад. */
export type Direction = 'en-ua' | 'ua-en';

export type DailyNewLimit = 10 | 15 | 20 | 25;
export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  dailyNew: DailyNewLimit;
  autoSpeak: boolean;
  theme: Theme;
  controlReview: boolean;
}

/** [нових вивчено, повторень, «забув» у повтореннях] за день. */
export type HistoryEntry = [newWords: number, reviews: number, lapses: number];
export type History = Record<number, HistoryEntry>;

export interface Today {
  day: number;
  newDone: number;
  /** Додатковий ліміт від «Ще 5 слів». */
  extra: number;
}

export interface AppState {
  v: number;
  words: WordsMap;
  settings: Settings;
  history: History;
  today: Today;
  /** Час скидання прогресу: при синхронізації старіші записи відкидаються. */
  resetAt?: number;
  updatedAt: number;
}
