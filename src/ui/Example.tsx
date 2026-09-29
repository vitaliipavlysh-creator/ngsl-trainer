import { clozeHint, splitByForm } from '../core/cloze';
import type { Word } from '../core/data';
import { RATE_EXAMPLE } from '../lib/speech';
import { SpeakButton } from './SpeakButton';

/** Приклад із підсвіченим словом (`highlight`) або з пропуском і підказкою (`cloze`). */
export function Example({ word, mode }: { word: Word; mode: 'highlight' | 'cloze' }) {
  const parts = splitByForm(word.example, word.form);
  return (
    <p className="flex items-start justify-center gap-1 text-center">
      <span className="font-serif text-lg leading-relaxed">
        {parts.map((p, i) =>
          !p.match ? (
            <span key={i}>{p.text}</span>
          ) : mode === 'highlight' ? (
            <mark key={i} className="rounded bg-accent/15 px-0.5 font-semibold text-fg">
              {p.text}
            </mark>
          ) : (
            <span
              key={i}
              className="whitespace-nowrap rounded bg-surface-2 px-1.5 font-mono text-base tracking-wide text-accent"
              aria-label={`пропуск, ${p.text.length} літер, починається на ${p.text[0]}`}
            >
              {clozeHint(p.text)}
            </span>
          ),
        )}
      </span>
      {mode === 'highlight' && (
        <SpeakButton
          text={word.example}
          rate={RATE_EXAMPLE}
          label="Озвучити приклад"
          className="-my-1.5 size-9"
        />
      )}
    </p>
  );
}
