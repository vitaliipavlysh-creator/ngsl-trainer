import { describe, expect, it } from 'vitest';
import { pluralN, WORD_FORMS, DAY_FORMS } from './plural';

describe('plural', () => {
  it.each([
    [1, '1 слово'],
    [2, '2 слова'],
    [4, '4 слова'],
    [5, '5 слів'],
    [11, '11 слів'],
    [21, '21 слово'],
    [22, '22 слова'],
    [0, '0 слів'],
    [2801, '2801 слово'],
  ])('%i', (n, text) => {
    expect(pluralN(n, WORD_FORMS)).toBe(text);
  });

  it('дні', () => {
    expect(pluralN(3, DAY_FORMS)).toBe('3 дні');
    expect(pluralN(7, DAY_FORMS)).toBe('7 днів');
  });
});
