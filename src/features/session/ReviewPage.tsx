import { useEffect } from 'react';
import { navigate } from '../../app/router';
import { pluralN, WORD_FORMS } from '../../core/plural';
import { isLeech } from '../../core/scheduler';
import { reviewProgress } from '../../core/session';
import { newLeft, rollToday } from '../../core/stats';
import { wordByRank } from '../../data/words';
import { useHotkeys } from '../../lib/hotkeys';
import { speak } from '../../lib/speech';
import { useDay } from '../../lib/useDay';
import { appStore, useApp } from '../../store/store';
import { Button } from '../../ui/Button';
import { EnUaCard, UaEnCard } from './cards';
import { AnswerButtons, Badge, SessionShell } from './SessionShell';
import { exitSession, startLearn } from './start';

// Гарячі клавіші читають живий стан стору — без залежності від останнього рендеру.
function currentReview() {
  const session = appStore.getState().session;
  return session?.kind === 'review' ? session : null;
}

function onPrimary() {
  const review = currentReview();
  if (!review) return;
  const a = appStore.getState();
  if (review.s.queue[0]) {
    if (!review.revealed) a.reveal();
  } else if (review.s.pending.length > 0) a.nextRound();
  else exitSession();
}

function onAnswer(remembered: boolean) {
  const review = currentReview();
  if (review?.revealed && review.s.queue[0]) appStore.getState().answer(remembered);
}

export function ReviewPage() {
  const session = useApp((s) => s.session);
  const autoSpeak = useApp((s) => s.app.settings.autoSpeak);
  const canUndo = useApp((s) => s.undoStack.length > 0);
  const day = useDay();
  const canLearn = useApp(
    (s) =>
      newLeft(rollToday(s.app.today, day), s.app.settings) > 0 &&
      Object.values(s.app.words).some((w) => w.s === 'queued'),
  );

  const review = session?.kind === 'review' ? session : null;
  const card = review?.s.queue[0];
  const ws = useApp((s) => (card ? s.app.words[card.rank] : undefined));
  const word = card ? wordByRank(card.rank) : null;
  const revealed = review?.revealed ?? false;
  // EN→UA: озвучуємо слово одразу; UA→EN — після «Показати», щоб не підказати.
  const speakText =
    autoSpeak && word && card && (card.dir === 'en-ua' ? !revealed : revealed) ? word.word : null;
  const step = review?.step;

  useEffect(() => {
    if (!review) navigate('/', { replace: true });
  }, [review]);

  useEffect(() => {
    if (speakText) speak(speakText);
  }, [speakText, step]);

  const a = appStore.getState();
  const more = review?.s.pending.length ?? 0;
  useHotkeys({
    Escape: exitSession,
    KeyU: a.undo,
    KeyS: () => {
      const c = currentReview()?.s.queue[0];
      if (c) speak(wordByRank(c.rank).word);
    },
    Space: onPrimary,
    Enter: onPrimary,
    Digit1: () => onAnswer(false),
    Digit2: () => onAnswer(true),
  });

  if (!review) return null;
  const shell = {
    progress: reviewProgress(review.s),
    canUndo,
    onUndo: a.undo,
    onExit: exitSession,
  };

  if (!card || !word) {
    const { round } = review.s;
    return (
      <SessionShell
        {...shell}
        footer={
          <div className="flex flex-col gap-2">
            {more > 0 ? (
              <Button variant="primary" size="lg" onClick={a.nextRound}>
                Далі: ще {pluralN(more, WORD_FORMS)}
              </Button>
            ) : (
              canLearn && (
                <Button variant="primary" size="lg" onClick={() => startLearn()}>
                  Вчити нові слова
                </Button>
              )
            )}
            <Button variant="ghost" size="lg" onClick={exitSession}>
              {more > 0 ? 'Досить на сьогодні' : 'На головну'}
            </Button>
          </div>
        }
      >
        <div className="animate-appear text-center">
          <h2 className="text-2xl font-semibold">
            {more > 0 ? 'Раунд завершено' : 'Повторення завершено'}
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-known/12 p-4">
              <p className="font-mono text-4xl font-semibold text-known">{round.remembered}</p>
              <p className="mt-1 text-sm text-muted">згадав</p>
            </div>
            <div className="rounded-2xl bg-queued/12 p-4">
              <p className="font-mono text-4xl font-semibold text-queued">{round.forgot}</p>
              <p className="mt-1 text-sm text-muted">забув</p>
            </div>
          </div>
          {round.forgot > 0 && (
            <p className="mt-4 text-sm text-muted">Забуті слова повернуться завтра з етапу 1.</p>
          )}
        </div>
      </SessionShell>
    );
  }

  const badges = (
    <>
      {card.attempt > 0 ? (
        <Badge>Вправа</Badge>
      ) : (
        <Badge>{ws?.s === 'mastered' ? 'Контроль' : `Етап ${ws?.st ?? 1}`}</Badge>
      )}
      <Badge>{card.dir === 'en-ua' ? 'Що означає?' : 'Як англійською?'}</Badge>
      {isLeech(ws) && <Badge tone="hard">Важке</Badge>}
    </>
  );

  return (
    <SessionShell
      {...shell}
      footer={
        revealed ? (
          <AnswerButtons onAnswer={a.answer} />
        ) : (
          <Button variant="primary" size="lg" className="w-full" onClick={a.reveal}>
            Показати
          </Button>
        )
      }
    >
      <div key={review.step} className="animate-appear">
        {card.dir === 'en-ua' ? (
          <EnUaCard word={word} revealed={revealed} badges={badges} />
        ) : (
          <UaEnCard word={word} revealed={revealed} badges={badges} />
        )}
      </div>
    </SessionShell>
  );
}
