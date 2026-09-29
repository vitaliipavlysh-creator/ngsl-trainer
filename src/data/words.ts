import rows from 'virtual:ngsl-words';
import type { Word } from '../core/data';

export const WORDS: readonly Word[] = rows.map(([word, translation, example, form], i) => ({
  rank: i + 1,
  word,
  translation,
  example,
  form,
}));

export function wordByRank(rank: number): Word {
  const word = WORDS[rank - 1];
  if (!word) throw new Error(`Немає слова з рангом ${rank}`);
  return word;
}
