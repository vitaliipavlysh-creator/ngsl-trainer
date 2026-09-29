import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { parseTsv, validateWords } from '../src/core/data.ts';
import { pluralN } from '../src/core/plural.ts';

const VIRTUAL_ID = 'virtual:ngsl-words';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/**
 * Віддає `data/ngsl-uk.tsv` як модуль `virtual:ngsl-words` (компактний масив).
 * Якщо дані некоректні — збірка падає зі списком помилок.
 */
export function ngslData(file = 'data/ngsl-uk.tsv'): Plugin {
  const path = resolve(file);
  return {
    name: 'ngsl-data',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      this.addWatchFile(path);
      const words = parseTsv(readFileSync(path, 'utf8'));
      const errors = validateWords(words);
      if (errors.length > 0) {
        this.error(
          `${file}: ${pluralN(errors.length, ['помилка', 'помилки', 'помилок'])}\n${errors.slice(0, 20).join('\n')}`,
        );
      }
      const rows = words.map((w) => [w.word, w.translation, w.example, w.form]);
      return `export default ${JSON.stringify(rows)};`;
    },
  };
}
