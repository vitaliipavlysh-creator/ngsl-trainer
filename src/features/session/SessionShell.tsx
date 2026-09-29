import type { ReactNode } from 'react';
import { CloseIcon, UndoIcon } from '../../ui/icons';
import { ProgressBar } from '../../ui/ProgressBar';

export function SessionShell({
  progress,
  canUndo,
  onUndo,
  onExit,
  footer,
  children,
}: {
  progress: { done: number; total: number };
  canUndo: boolean;
  onUndo: () => void;
  onExit: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const iconBtn =
    'inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-30';
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="flex items-center gap-2 px-2 pt-[max(env(safe-area-inset-top),0.5rem)]">
        <button type="button" className={iconBtn} aria-label="Вийти (Esc)" onClick={onExit}>
          <CloseIcon />
        </button>
        <div className="flex-1">
          <ProgressBar
            value={progress.total ? progress.done / progress.total : 0}
            label="Прогрес сесії"
          />
        </div>
        <span className="min-w-12 text-center font-mono text-sm tabular-nums text-muted">
          {progress.done}/{progress.total}
        </span>
        <button
          type="button"
          className={iconBtn}
          aria-label="Скасувати відповідь (U)"
          title="Скасувати відповідь (U)"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <UndoIcon />
        </button>
      </header>
      <main className="flex flex-1 flex-col justify-center px-4 py-6">{children}</main>
      {footer && (
        <footer className="sticky bottom-0 bg-bg px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-2">
          {footer}
        </footer>
      )}
    </div>
  );
}

/** Дві кнопки відповіді внизу екрана. */
export function AnswerButtons({ onAnswer }: { onAnswer: (remembered: boolean) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onAnswer(false)}
        className="flex min-h-14 flex-col items-center justify-center rounded-xl bg-queued text-on-status transition hover:brightness-110 active:scale-[0.98]"
      >
        <span className="font-medium">Забув</span>
        <span className="hidden text-xs opacity-80 md:block">клавіша 1</span>
      </button>
      <button
        type="button"
        onClick={() => onAnswer(true)}
        className="flex min-h-14 flex-col items-center justify-center rounded-xl bg-known text-on-status transition hover:brightness-110 active:scale-[0.98]"
      >
        <span className="font-medium">Згадав</span>
        <span className="hidden text-xs opacity-80 md:block">клавіша 2</span>
      </button>
    </div>
  );
}

export function Badge({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'hard';
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        tone === 'hard' ? 'bg-queued/15 text-queued' : 'bg-surface-2 text-muted'
      }`}
    >
      {children}
    </span>
  );
}
