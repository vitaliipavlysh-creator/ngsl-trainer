export interface Segment {
  text: string;
  /** Чи це входження слова (підсвітити або сховати). */
  match: boolean;
}

const LETTER = "A-Za-z'’";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Регулярка для `form` як цілого слова, без урахування регістру. */
export function formRegex(form: string): RegExp {
  return new RegExp(`(?<![${LETTER}])${escapeRegExp(form)}(?![${LETTER}])`, 'gi');
}

/** Ділить речення на шматки; входження `form` позначені `match`. */
export function splitByForm(example: string, form: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const m of example.matchAll(formRegex(form))) {
    const start = m.index;
    if (start > last) segments.push({ text: example.slice(last, start), match: false });
    segments.push({ text: m[0], match: true });
    last = start + m[0].length;
  }
  if (last < example.length) segments.push({ text: example.slice(last), match: false });
  return segments;
}

/** Підказка для пропуску: перша літера + `_` на кожну наступну; для 1–2 літер — `___`. */
export function clozeHint(form: string): string {
  if (form.length <= 2) return '___';
  return [form[0], ...Array.from({ length: form.length - 1 }, () => '_')].join(' ');
}

const VOWELS = 'aeiou';

/** Можливі словоформи для запасного пошуку (коли в даних немає `form`). */
function inflections(word: string): string[] {
  const w = word.toLowerCase();
  const forms = [`${w}s`, `${w}es`, `${w}ed`, `${w}d`, `${w}ing`, `${w}er`, `${w}est`];
  if (w.endsWith('y') && !VOWELS.includes(w.at(-2) ?? '')) {
    const stem = w.slice(0, -1);
    forms.push(`${stem}ies`, `${stem}ied`, `${stem}ier`, `${stem}iest`);
  }
  if (w.endsWith('e')) forms.push(`${w.slice(0, -1)}ing`);
  const last = w.at(-1) ?? '';
  if (w.length >= 3 && !VOWELS.includes(last) && VOWELS.includes(w.at(-2) ?? '')) {
    forms.push(`${w}${last}ed`, `${w}${last}ing`);
  }
  return forms;
}

/**
 * Запасний алгоритм пошуку форми слова в реченні:
 * точний збіг → відомі закінчення → префікс. Повертає форму як у реченні або `null`.
 */
export function findForm(example: string, word: string): string | null {
  const tokens = example.match(new RegExp(`[${LETTER}]+`, 'g')) ?? [];
  const lower = word.toLowerCase();
  const byLower = (target: string) => tokens.find((t) => t.toLowerCase() === target);
  const exact = byLower(lower);
  if (exact) return exact;
  for (const form of inflections(word)) {
    const hit = byLower(form);
    if (hit) return hit;
  }
  return tokens.find((t) => t.toLowerCase().startsWith(lower)) ?? null;
}
