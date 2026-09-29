import { useEffect } from 'react';
import { navigate } from '../../app/router';
import { plural } from '../../core/plural';
import { learnProgress } from '../../core/session';
import { dueCount } from '../../core/stats';
import { wordByRank } from '../../data/words';
import { useHotkeys } from '../../lib/hotkeys';
import { speak } from '../../lib/speech';
import { useDay } from '../../lib/useDay';
import { appStore, useApp } from '../../store/store';
import { Button } from '../../ui/Button';
import { IntroCard, UaEnCard } from './cards';
import { AnswerButtons, Badge, SessionShell } from './SessionShell';
import { exitSession, startLearn, startReview } from './start';

const NEW_FORMS = ['нове слово', 'нові слова', 'нових слів'] as const;

// Гарячі клавіші читають живий стан стору — без залежності від останнього рендеру.
function currentLearn() {
  const session = appStore.getState().session;
  return session?.kind === 'learn' ? session : null;
}

function onPrimary() {
  const learn = currentLearn();
  if (!learn) return;
  const card = learn.s.queue[0];
  const a = appStore.getState();
  if (!card) exitSession();
  else if (card.kind === 'intro') a.learnNext();
  else if (!learn.revealed) a.reveal();
}

function onAnswer(remembered: boolean) {
  const learn = currentLearn();
  if (learn?.revealed && learn.s.queue[0]?.kind === 'check') appStore.getState().answer(remembered);
}

export function LearnPage() {
  const session = useApp((s) => s.session);
  const autoSpeak = useApp((s) => s.app.settings.autoSpeak);
  const canUndo = useApp((s) => s.undoStack.length > 0);
  const hasQueue = useApp((s) => Object.values(s.app.words).some((w) => w.s === 'queued'));
  const day = useDay();
  const due = useApp((s) => dueCount(s.app.words, day));

  const learn = session?.kind === 'learn' ? session : null;
  const card = learn?.s.queue[0];
  const word = card ? wordByRank(card.rank) : null;
  const revealed = learn?.revealed ?? false;
  const speakText = autoSpeak && word && (card?.kind === 'intro' || revealed) ? word.word : null;
  const step = learn?.step;

  useEffect(() => {
    if (!learn) navigate('/', { replace: true });
  }, [learn]);

  useEffect(() => {
    if (speakText) speak(speakText);
  }, [speakText, step]);

  const a = appStore.getState();
  useHotkeys({
    Escape: exitSession,
    KeyU: a.undo,
    KeyS: () => {
      const c = currentLearn()?.s.queue[0];
      if (c) speak(wordByRank(c.rank).word);
    },
    KeyK: () => {
      if (currentLearn()?.s.queue[0]?.kind === 'intro') a.learnKnown();
    },
    Space: onPrimary,
    Enter: onPrimary,
    Digit1: () => onAnswer(false),
    Digit2: () => onAnswer(true),
  });

  if (!learn) return null;
  const progress = learnProgress(learn.s);
  const shell = { progress, canUndo, onUndo: a.undo, onExit: exitSession };

  if (!card || !word) {
    const { learned, knownMarked } = learn.s;
    return (
      <SessionShell
        {...shell}
        footer={
          <div className="flex flex-col gap-2">
            {due > 0 && (
              <Button variant="primary" size="lg" onClick={startReview}>
                До повторення ({due})
              </Button>
            )}
            {hasQueue && (
              <Button size="lg" onClick={() => startLearn(true)}>
                Ще 5 слів
              </Button>
            )}
            <Button variant="ghost" size="lg" onClick={exitSession}>
              На головну
            </Button>
          </div>
        }
      >
        <div className="animate-appear text-center">
          <p className="font-mono text-6xl font-semibold text-known">{learned.length}</p>
          <h2 className="mt-2 text-2xl font-semibold">
            {learned.length > 0
              ? `${plural(learned.length, NEW_FORMS)} у вивченні`
              : 'Сесію завершено'}
          </h2>
          <p className="mt-2 text-muted">
            {learned.length > 0 && 'Перше повторення — завтра.'}
            {knownMarked.length > 0 && ` Позначено як відомі: ${knownMarked.length}.`}
          </p>
        </div>
      </SessionShell>
    );
  }

  const badges = (
    <>
      <Badge>{card.kind === 'intro' ? 'Нове слово' : 'Перевірка'}</Badge>
      {card.kind === 'check' && <Badge>Як англійською?</Badge>}
    </>
  );

  let footer;
  if (card.kind === 'intro') {
    footer = (
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <Button size="lg" onClick={a.learnKnown} title="Я це знаю (K)">
          Я це знаю
        </Button>
        <Button variant="primary" size="lg" onClick={a.learnNext}>
          Далі
        </Button>
      </div>
    );
  } else if (!revealed) {
    footer = (
      <Button variant="primary" size="lg" className="w-full" onClick={a.reveal}>
        Показати
      </Button>
    );
  } else {
    footer = <AnswerButtons onAnswer={a.answer} />;
  }

  return (
    <SessionShell {...shell} footer={footer}>
      <div key={learn.step} className="animate-appear">
        {card.kind === 'intro' ? (
          <IntroCard word={word} badges={badges} />
        ) : (
          <UaEnCard word={word} revealed={revealed} badges={badges} />
        )}
      </div>
    </SessionShell>
  );
}
