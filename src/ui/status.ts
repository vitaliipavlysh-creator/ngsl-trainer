import type { Status } from '../core/types';

export const STATUS_ORDER: readonly Status[] = ['known', 'mastered', 'learning', 'queued', 'new'];

export const STATUS_LABEL: Record<Status, string> = {
  known: 'Знаю',
  mastered: 'Вивчено',
  learning: 'Вчу',
  queued: 'Черга',
  new: 'Не відсортовано',
};

export const STATUS_BG: Record<Status, string> = {
  known: 'bg-known',
  mastered: 'bg-mastered',
  learning: 'bg-learning',
  queued: 'bg-queued',
  new: 'bg-new',
};
