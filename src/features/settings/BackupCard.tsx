import { useRef, useState, type ChangeEvent } from 'react';
import type { AppState } from '../../core/types';
import { saveFile } from '../../lib/file';
import { migrate } from '../../store/state';
import { appStore } from '../../store/store';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { showToast } from '../../ui/toast';

const dateStamp = () => new Date().toISOString().slice(0, 10);

export function BackupCard() {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ state: AppState; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportFile = () => {
    const json = JSON.stringify(appStore.getState().app);
    void saveFile(`ngsl-progress-${dateStamp()}.json`, json).catch(() =>
      setError('Не вдалося зберегти файл.'),
    );
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const state = migrate(JSON.parse(await file.text()));
      if (!state) throw new Error('Файл порожній.');
      setPending({ state, name: file.name });
    } catch (err) {
      setError(
        err instanceof SyntaxError ? 'Це не файл прогресу NGSL Trainer.' : (err as Error).message,
      );
    }
  };

  const apply = (mode: 'merge' | 'replace') => {
    if (!pending) return;
    if (mode === 'replace' && !window.confirm('Замінити весь поточний прогрес вмістом файлу?'))
      return;
    appStore.getState().importState(pending.state, mode);
    setPending(null);
    showToast(mode === 'merge' ? 'Прогрес обʼєднано з файлом' : 'Прогрес відновлено з файлу');
  };

  const words = pending ? Object.keys(pending.state.words).length : 0;

  return (
    <Card>
      <h2 className="font-medium">Резервна копія</h2>
      <p className="mt-1 text-sm text-muted">
        Файл із усім прогресом — на випадок перевстановлення чи зміни телефону.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={exportFile}>Зберегти копію</Button>
        <Button onClick={() => input.current?.click()}>Відновити з файлу</Button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void onFile(e)}
          aria-label="Файл резервної копії"
        />
      </div>
      {pending && (
        <div className="mt-3 rounded-xl border border-line bg-bg p-3 text-sm">
          <p>
            <b>{pending.name}</b>: статуси {words} слів.
          </p>
          <p className="mt-1 text-muted">
            «Обʼєднати» — додасть дані з файлу до поточних (для кожного слова лишиться новіший
            запис). «Замінити» — поточний прогрес зникне.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => apply('merge')}>
              Обʼєднати
            </Button>
            <Button variant="danger" onClick={() => apply('replace')}>
              Замінити
            </Button>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Скасувати
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-queued">
          {error}
        </p>
      )}
    </Card>
  );
}
