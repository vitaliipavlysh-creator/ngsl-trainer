import { describe, expect, it } from 'vitest';
import { clozeHint, findForm, splitByForm } from './cloze';

describe('splitByForm', () => {
  it('знаходить ціле слово без урахування регістру', () => {
    expect(splitByForm('According to the report, sales are up.', 'according')).toEqual([
      { text: 'According', match: true },
      { text: ' to the report, sales are up.', match: false },
    ]);
  });

  it('позначає всі входження', () => {
    const parts = splitByForm('What do you do?', 'do');
    expect(parts.filter((p) => p.match)).toHaveLength(2);
  });

  it('не чіпає частини інших слів', () => {
    expect(splitByForm('Another day.', 'other').some((p) => p.match)).toBe(false);
    expect(splitByForm("I'm here, I think.", 'I').filter((p) => p.match)).toHaveLength(1);
  });
});

describe('clozeHint', () => {
  it('перша літера й підкреслення', () => {
    expect(clozeHint('duties')).toBe('d _ _ _ _ _');
  });
  it('для 1–2 літер — ___', () => {
    expect(clozeHint('to')).toBe('___');
    expect(clozeHint('I')).toBe('___');
  });
});

describe('findForm', () => {
  it.each([
    ['What are your main duties?', 'duty', 'duties'],
    ['She is making tea.', 'make', 'making'],
    ['He stopped the car.', 'stop', 'stopped'],
    ['The price includes breakfast.', 'include', 'includes'],
    ['I like it.', 'like', 'like'],
  ])('%s → %s', (example, word, form) => {
    expect(findForm(example, word)).toBe(form);
  });

  it('повертає null, якщо слова немає', () => {
    expect(findForm('Nothing here.', 'cat')).toBeNull();
  });
});
