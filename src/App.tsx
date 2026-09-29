import { BLOCK_COUNT } from './core/blocks';
import { pluralN, WORD_FORMS, BLOCK_FORMS } from './core/plural';
import { WORDS } from './data/words';

export function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-3 px-4">
      <h1 className="font-serif text-3xl font-semibold">NGSL Trainer</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        {pluralN(WORDS.length, WORD_FORMS)} у {pluralN(BLOCK_COUNT, BLOCK_FORMS)}. Застосунок у
        розробці.
      </p>
    </main>
  );
}
