import type { ReactNode } from 'react';
import type { Word } from '../../core/data';
import { Example } from '../../ui/Example';
import { SpeakButton } from '../../ui/SpeakButton';

export function Badges({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-center gap-2">{children}</div>;
}

export function EnglishWord({ word }: { word: Word }) {
  return (
    <div className="flex items-center justify-center gap-1">
      <h2 className="break-words font-serif text-4xl font-semibold leading-tight sm:text-5xl">
        {word.word}
      </h2>
      <SpeakButton text={word.word} />
    </div>
  );
}

export function Translation({ word, large = false }: { word: Word; large?: boolean }) {
  return (
    <p className={large ? 'text-2xl font-medium leading-snug' : 'text-xl'}>{word.translation}</p>
  );
}

/** EN→UA: слово + приклад → згадати значення. */
export function EnUaCard({
  word,
  revealed,
  badges,
}: {
  word: Word;
  revealed: boolean;
  badges: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 text-center">
      <Badges>{badges}</Badges>
      <EnglishWord word={word} />
      <Example word={word} mode="highlight" />
      <div aria-live="polite" className="min-h-9">
        {revealed && (
          <div className="animate-appear border-t border-line pt-5">
            <Translation word={word} large />
          </div>
        )}
      </div>
    </div>
  );
}

/** UA→EN: переклад + приклад із пропуском → згадати слово. */
export function UaEnCard({
  word,
  revealed,
  badges,
}: {
  word: Word;
  revealed: boolean;
  badges: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 text-center">
      <Badges>{badges}</Badges>
      <Translation word={word} large />
      <Example word={word} mode={revealed ? 'highlight' : 'cloze'} />
      <div aria-live="polite" className="min-h-14">
        {revealed && (
          <div className="animate-appear border-t border-line pt-5">
            <EnglishWord word={word} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Картка-знайомство: усе одразу. */
export function IntroCard({ word, badges }: { word: Word; badges: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 text-center">
      <Badges>{badges}</Badges>
      <EnglishWord word={word} />
      <Translation word={word} large />
      <Example word={word} mode="highlight" />
    </div>
  );
}
