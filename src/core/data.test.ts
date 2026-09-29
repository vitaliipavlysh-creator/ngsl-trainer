import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLOCK_COUNT, blockOf, blockRanks } from './blocks';
import { findForm, splitByForm } from './cloze';
import { parseTsv, TOTAL_WORDS, validateWords, type Word } from './data';

const words = parseTsv(readFileSync('data/ngsl-uk.tsv', 'utf8'));

describe('ngsl-uk.tsv', () => {
  it('містить 2801 коректне слово', () => {
    expect(words).toHaveLength(TOTAL_WORDS);
    expect(validateWords(words)).toEqual([]);
  });

  it('кожна форма знаходиться в прикладі', () => {
    for (const w of words) {
      expect(
        splitByForm(w.example, w.form).some((s) => s.match),
        w.word,
      ).toBe(true);
    }
  });

  it('запасний алгоритм знаходить ту саму форму, що й у даних', () => {
    for (const w of words) {
      expect(findForm(w.example, w.word)?.toLowerCase(), w.word).toBe(w.form.toLowerCase());
    }
  });
});

describe('блоки', () => {
  it('56 блоків: 55 по 50 і останній на 51', () => {
    const sizes = Array.from({ length: BLOCK_COUNT }, (_, i) => blockRanks(i + 1).length);
    expect(sizes.slice(0, 55).every((n) => n === 50)).toBe(true);
    expect(sizes[55]).toBe(51);
    expect(sizes.reduce((a, b) => a + b)).toBe(TOTAL_WORDS);
  });

  it('blockOf узгоджений з blockRanks', () => {
    expect(blockOf(1)).toBe(1);
    expect(blockOf(50)).toBe(1);
    expect(blockOf(51)).toBe(2);
    expect(blockOf(2750)).toBe(55);
    expect(blockOf(2751)).toBe(56);
    expect(blockOf(2801)).toBe(56);
  });
});

describe('validateWords', () => {
  const broken = (patch: (w: Word[]) => void) => {
    const copy = words.map((w) => ({ ...w }));
    patch(copy);
    return validateWords(copy);
  };

  it('ловить пропущений ранг, порожнє поле, дублікат і відсутню форму', () => {
    expect(broken((w) => w.splice(10, 1))).not.toEqual([]);
    expect(broken((w) => ((w[5] as Word).translation = ''))).toContainEqual(
      expect.stringContaining('translation'),
    );
    expect(broken((w) => ((w[7] as Word).word = 'the'))).toContainEqual(
      expect.stringContaining('дублікат'),
    );
    expect(broken((w) => ((w[1] as Word).form = 'zzz'))).toContainEqual(
      expect.stringContaining('не знайдена'),
    );
  });

  it('parseTsv відкидає неправильний заголовок', () => {
    expect(() => parseTsv('rank\tword\n1\tthe')).toThrow();
  });

  it('parseTsv відкидає рядок із зайвою колонкою', () => {
    const header = 'rank\tword\ttranslation\texample\tform';
    expect(() => parseTsv(`${header}\n1\tthe\tартикль\tThe cat.\tThe\textra`)).toThrow('рядок 2');
  });
});
