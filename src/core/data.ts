import { formRegex } from './cloze.ts';

export interface Word {
  rank: number;
  word: string;
  translation: string;
  example: string;
  /** Точна форма слова в `example`, яку ховаємо в пропуску. */
  form: string;
}

export const TOTAL_WORDS = 2801;
export const TSV_COLUMNS = ['rank', 'word', 'translation', 'example', 'form'] as const;

/** Розбирає TSV. Кидає помилку на неправильному заголовку чи кількості колонок; решту ловить `validateWords`. */
export function parseTsv(text: string): Word[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const header = lines[0]?.split('\t') ?? [];
  if (header.join('\t') !== TSV_COLUMNS.join('\t')) {
    throw new Error(`TSV: очікується заголовок "${TSV_COLUMNS.join(' | ')}"`);
  }
  return lines
    .slice(1)
    .map((line, i) => ({ line, lineNo: i + 2 }))
    .filter(({ line }) => line.trim() !== '')
    .map(({ line, lineNo }) => {
      const fields = line.split('\t');
      if (fields.length !== TSV_COLUMNS.length) {
        throw new Error(
          `TSV, рядок ${lineNo}: ${fields.length} колонок замість ${TSV_COLUMNS.length}`,
        );
      }
      const [rank = '', word = '', translation = '', example = '', form = ''] = fields;
      return {
        rank: Number(rank),
        word: word.trim(),
        translation: translation.trim(),
        example: example.trim(),
        form: form.trim(),
      };
    });
}

/** Повертає список помилок; порожній список — дані коректні. */
export function validateWords(words: readonly Word[]): string[] {
  const errors: string[] = [];
  if (words.length !== TOTAL_WORDS) {
    errors.push(`очікується ${TOTAL_WORDS} слів, отримано ${words.length}`);
  }
  const seen = new Set<string>();
  words.forEach((w, i) => {
    const at = `рядок ${i + 2}`;
    if (w.rank !== i + 1) errors.push(`${at}: ранг ${w.rank}, очікується ${i + 1}`);
    for (const key of ['word', 'translation', 'example', 'form'] as const) {
      if (!w[key]) errors.push(`${at}: порожнє поле ${key}`);
    }
    const key = w.word.toLowerCase();
    if (seen.has(key)) errors.push(`${at}: дублікат "${w.word}"`);
    seen.add(key);
    if (w.form && w.example && !formRegex(w.form).test(w.example)) {
      errors.push(`${at}: форма "${w.form}" не знайдена в прикладі`);
    }
  });
  return errors;
}
