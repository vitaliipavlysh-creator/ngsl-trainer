import { useMemo } from 'react';
import { navigate } from '../../app/router';
import { TOTAL_WORDS } from '../../core/data';
import { dayLabel } from '../../core/dates';
import { DAY_FORMS, plural, pluralN, WORD_FORMS } from '../../core/plural';
import {
  currentBlock,
  dueCount,
  newLeft,
  nextDue,
  progressPercent,
  rollToday,
  statusCounts,
  streak,
} from '../../core/stats';
import { formatPercent } from '../../lib/format';
import { useDay } from '../../lib/useDay';
import { useApp } from '../../store/store';
import { useSync } from '../../sync';
import { startLearn, startReview } from '../session/start';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { FlameIcon } from '../../ui/icons';
import { ProgressBar } from '../../ui/ProgressBar';
import { StatusBar } from '../../ui/StatusBar';
import { InstallHint } from './InstallHint';

/** Коли прострочених стільки, радимо спершу повторити. */
const BACKLOG = 50;

export function TodayPage() {
  const app = useApp((s) => s.app);
  const day = useDay();
  const today = rollToday(app.today, day);
  const counts = useMemo(() => statusCounts(app.words), [app.words]);
  const due = useMemo(() => dueCount(app.words, day), [app.words, day]);
  const next = useMemo(() => nextDue(app.words, day), [app.words, day]);
  const block = currentBlock(app.words);
  const days = streak(app.history, day);
  const left = newLeft(today, app.settings);
  const limit = app.settings.dailyNew + today.extra;
  const queue = counts.queued;
  const fresh = counts.new === TOTAL_WORDS;
  // Офлайн — нормальна ситуація; показуємо лише помилки, що потребують дії.
  const syncError = useSync((s) =>
    s.state === 'error' && s.errorKind !== 'network' ? s.error : null,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Сьогодні</h1>
        {days > 0 && (
          <span
            className="flex items-center gap-1.5 rounded-full bg-learning/15 px-3 py-1 text-sm"
            title="Дні поспіль із заняттями"
          >
            <FlameIcon width={16} height={16} className="text-learning" />
            <span>
              <span className="font-mono font-semibold">{days}</span> {plural(days, DAY_FORMS)}
            </span>
          </span>
        )}
      </div>

      {syncError && (
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="rounded-xl border border-queued/40 bg-queued/10 p-3 text-left text-sm"
        >
          <b>Синхронізація не працює.</b> {syncError}
        </button>
      )}

      {fresh && (
        <Card className="border-accent/40 bg-accent/5">
          <h2 className="font-medium">Почнімо!</h2>
          <p className="mt-1 text-sm text-muted">
            2801 найуживаніше слово поділено на 56 блоків. У кожному блоці тапни слова, яких не
            знаєш, — вони стануть у чергу на вивчення. Потім щодня: повторення й кілька нових слів.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => navigate('/sort/1')}>
              Відсортувати блок 1
            </Button>
            <Button variant="ghost" onClick={() => navigate('/guide')}>
              Як вчитися
            </Button>
          </div>
        </Card>
      )}

      {!fresh && (
        <Card>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-medium">Повторення</h2>
            {due > BACKLOG && <span className="text-sm text-queued">Багато прострочених</span>}
          </div>
          {due > 0 ? (
            <>
              <p className="mt-1">
                <span className="font-mono text-3xl font-semibold">{due}</span>{' '}
                <span className="text-muted">{plural(due, WORD_FORMS)} на сьогодні</span>
              </p>
              <Button variant="primary" size="lg" className="mt-3 w-full" onClick={startReview}>
                Повторити
              </Button>
            </>
          ) : (
            <p className="mt-1 text-muted">
              {next
                ? `Усе повторено. Наступне — ${dayLabel(next.day, day)}: ${pluralN(next.count, WORD_FORMS)}.`
                : 'Поки нічого повторювати. Вивчені слова зʼявляться тут наступного дня.'}
            </p>
          )}
        </Card>
      )}

      {!fresh && (
        <Card>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-medium">Нові слова</h2>
            <span className="text-sm text-muted">у черзі: {queue}</span>
          </div>
          <p className="mt-1">
            <span className="font-mono text-3xl font-semibold">{today.newDone}</span>{' '}
            <span className="text-muted">з {limit} на сьогодні</span>
          </p>
          <div className="mt-2">
            <ProgressBar value={limit ? today.newDone / limit : 0} label="Нові слова за сьогодні" />
          </div>

          {queue === 0 ? (
            block ? (
              <>
                <p className="mt-3 text-sm">Черга порожня — відсортуй блок {block}.</p>
                <Button
                  variant="primary"
                  className="mt-3 w-full"
                  onClick={() => navigate(`/sort/${block}`)}
                >
                  Відсортувати блок {block}
                </Button>
              </>
            ) : (
              <p className="mt-3 text-sm">Усі слова відсортовано, черга порожня. Чудова робота!</p>
            )
          ) : left > 0 ? (
            <>
              {due > BACKLOG && (
                <p className="mt-3 text-sm text-muted">
                  Спершу повторення — так нові слова не нашаруються на забуті.
                </p>
              )}
              <Button
                variant={due > 0 ? 'secondary' : 'primary'}
                size="lg"
                className="mt-3 w-full"
                onClick={() => startLearn()}
              >
                Вчити {pluralN(Math.min(left, queue), WORD_FORMS)}
              </Button>
              {queue < left && block && (
                <button
                  type="button"
                  className="mt-2 min-h-11 w-full text-sm text-accent"
                  onClick={() => navigate(`/sort/${block}`)}
                >
                  У черзі менше, ніж ліміт, — відсортуй блок {block}
                </button>
              )}
            </>
          ) : (
            <>
              <p className="mt-3 text-sm">Денний ліміт виконано.</p>
              <Button className="mt-3 w-full" onClick={() => startLearn(true)}>
                Ще 5 слів
              </Button>
            </>
          )}
        </Card>
      )}

      <Card>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-medium">Прогрес</h2>
          <span className="font-mono text-2xl font-semibold">
            {formatPercent(progressPercent(counts))}
          </span>
        </div>
        <p className="mb-3 text-sm text-muted">«знаю» + «вивчено» з 2801 слова</p>
        <StatusBar counts={counts} legend />
      </Card>

      <button
        type="button"
        onClick={() => navigate('/guide')}
        className="flex min-h-11 items-center justify-between rounded-2xl border border-line bg-surface p-4 text-left"
      >
        <span>
          <span className="block font-medium">Як вчитися з найбільшим ефектом</span>
          <span className="block text-sm text-muted">11 коротких порад і щоденний ритуал</span>
        </span>
        <span aria-hidden="true" className="text-muted">
          →
        </span>
      </button>

      <InstallHint />
    </div>
  );
}
