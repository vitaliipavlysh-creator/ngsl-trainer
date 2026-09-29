import { useState } from 'react';
import { isIos, isStandalone, promptInstall, useCanPromptInstall } from '../../lib/install';
import { readLocal, writeLocal } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { CloseIcon } from '../../ui/icons';

const KEY = 'ngsl-install-hint-hidden';

/** Підказка встановити PWA: офлайн і захист даних від очищення браузером (особливо iOS). */
export function InstallHint() {
  const canPrompt = useCanPromptInstall();
  const [hidden, setHidden] = useState(() => readLocal(KEY) === '1' || isStandalone());
  const ios = isIos();
  if (hidden || (!canPrompt && !ios)) return null;

  const hide = () => {
    writeLocal(KEY, '1');
    setHidden(true);
  };

  return (
    <Card className="relative pr-12">
      <h2 className="font-medium">Встанови на головний екран</h2>
      <p className="mt-1 text-sm text-muted">
        Працює офлайн, відкривається як застосунок
        {ios ? ', а Safari не видалить прогрес через тиждень без відвідувань' : ''}.
      </p>
      {canPrompt ? (
        <Button variant="primary" className="mt-3" onClick={() => void promptInstall()}>
          Встановити
        </Button>
      ) : (
        <p className="mt-2 text-sm">
          У Safari: <b>Поділитися</b> → <b>На початковий екран</b>.
        </p>
      )}
      <button
        type="button"
        aria-label="Сховати підказку"
        onClick={hide}
        className="absolute right-1 top-1 inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-2"
      >
        <CloseIcon width={18} height={18} />
      </button>
    </Card>
  );
}
