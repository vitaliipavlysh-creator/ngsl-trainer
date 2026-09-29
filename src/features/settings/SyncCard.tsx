import { useEffect, useState, type FormEvent } from 'react';
import { sync, useSync } from '../../sync';
import { profileSlug } from '../../sync/gist';
import { timeAgo } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { showToast } from '../../ui/toast';

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function SyncCard() {
  const { state, lastSyncAt, error, gistId, profile } = useSync((s) => s);
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const now = useNow();

  const connect = async (e: FormEvent) => {
    e.preventDefault();
    if (!token.trim() || !profileSlug(name)) return;
    setBusy(true);
    setConnectError(null);
    try {
      await sync.connect(token, name);
      setToken('');
      setName('');
      showToast('Синхронізацію підключено');
    } catch (err) {
      setConnectError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    if (!window.confirm('Відключити синхронізацію на цьому пристрої? Прогрес у Gist залишиться.'))
      return;
    sync.disconnect();
  };

  if (state === 'off') {
    return (
      <Card>
        <h2 className="font-medium">Синхронізація</h2>
        <p className="mt-1 text-sm text-muted">
          Прогрес зберігається у твоєму секретному GitHub Gist — один і той самий на телефоні й ПК.
          Заодно це автоматичний бекап.
        </p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
          <li>
            <a className="text-accent underline" href={TOKEN_URL} target="_blank" rel="noreferrer">
              Створи токен на GitHub
            </a>
            : <b>Fine-grained token</b> → Account permissions → <b>Gists: Read and write</b>. Строк
            дії — наприклад, рік.
          </li>
          <li>
            Введи своє імʼя й токен — на кожному своєму пристрої однаково. Кілька людей можуть
            користуватися одним акаунтом: у кожного імені окремий прогрес.
          </li>
        </ol>
        <form onSubmit={(e) => void connect(e)} className="mt-3 flex flex-col gap-2">
          <input
            type="text"
            autoComplete="nickname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Імʼя профілю, напр. Анна"
            aria-label="Імʼя профілю"
            maxLength={40}
            className="min-h-11 rounded-xl border border-line bg-bg px-3 text-[15px] outline-none focus:border-accent"
          />
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="github_pat_…"
            aria-label="Токен GitHub"
            className="min-h-11 rounded-xl border border-line bg-bg px-3 font-mono text-sm outline-none focus:border-accent"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !token.trim() || !profileSlug(name)}
          >
            {busy ? 'Підключаю…' : 'Підключити'}
          </Button>
          {connectError && (
            <p role="alert" className="text-sm text-queued">
              {connectError}
            </p>
          )}
        </form>
        <p className="mt-3 text-xs text-muted">
          Токен дає доступ до всіх Gist акаунта. Даючи комусь токен від свого акаунта, створи
          окремий — тоді його можна відкликати, не чіпаючи свій.
        </p>
      </Card>
    );
  }

  const dot =
    state === 'error'
      ? 'bg-queued'
      : state === 'syncing'
        ? 'bg-learning animate-pulse'
        : 'bg-known';
  const label =
    state === 'syncing'
      ? 'Синхронізую…'
      : state === 'error'
        ? error
        : lastSyncAt
          ? `Синхронізовано ${timeAgo(lastSyncAt, now)}`
          : 'Підключено';

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-medium">Синхронізація</h2>
        <span className="text-sm text-muted">
          Профіль: <b className="text-fg">{profile || 'основний'}</b>
        </span>
      </div>
      <p className="mt-2 flex items-start gap-2 text-sm" aria-live="polite">
        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${dot}`} />
        <span className={state === 'error' ? 'text-queued' : ''}>{label}</span>
      </p>
      <p className="mt-1 text-sm text-muted">
        Автоматично: при відкритті, поверненні в застосунок і через кілька секунд після відповідей.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={state === 'syncing'}
          onClick={() => void sync.syncNow()}
        >
          Синхронізувати зараз
        </Button>
        <Button variant="ghost" onClick={disconnect}>
          Відключити
        </Button>
      </div>
      {gistId && (
        <a
          className="mt-3 inline-block text-sm text-accent underline"
          href={`https://gist.github.com/${gistId}`}
          target="_blank"
          rel="noreferrer"
        >
          Відкрити Gist на GitHub
        </a>
      )}
    </Card>
  );
}
