export type PluralForms = readonly [one: string, few: string, many: string];

const rules = new Intl.PluralRules('uk');

/** Українська форма слова для числа: 1 слово / 2 слова / 5 слів. */
export function plural(n: number, [one, few, many]: PluralForms): string {
  switch (rules.select(n)) {
    case 'one':
      return one;
    case 'many':
      return many;
    default:
      return few;
  }
}

/** Число разом зі словом: «21 слово». */
export function pluralN(n: number, forms: PluralForms): string {
  return `${n} ${plural(n, forms)}`;
}

export const WORD_FORMS: PluralForms = ['слово', 'слова', 'слів'];
export const DAY_FORMS: PluralForms = ['день', 'дні', 'днів'];
export const BLOCK_FORMS: PluralForms = ['блок', 'блоки', 'блоків'];
