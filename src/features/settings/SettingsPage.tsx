import { navigate } from '../../app/router';
import type { DailyNewLimit, Theme } from '../../core/types';
import { useSpeechAvailable } from '../../lib/speech';
import { appStore, useApp } from '../../store/store';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Segmented } from '../../ui/Segmented';
import { showToast } from '../../ui/toast';
import { Toggle } from '../../ui/Toggle';
import { BackupCard } from './BackupCard';
import { ReminderCard } from './ReminderCard';
import { SyncCard } from './SyncCard';

const LIMITS = [10, 15, 20, 25].map((n) => ({ value: n as DailyNewLimit, label: String(n) }));
const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Системна' },
  { value: 'light', label: 'Світла' },
  { value: 'dark', label: 'Темна' },
];

export function SettingsPage() {
  const settings = useApp((s) => s.app.settings);
  const speech = useSpeechAvailable();
  const update = appStore.getState().updateSettings;

  const reset = () => {
    if (!window.confirm('Скинути весь прогрес? Статуси всіх слів і історія зникнуть.')) return;
    appStore.getState().resetProgress();
    showToast('Прогрес скинуто');
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Налаштування</h1>

      <Card>
        <h2 className="mb-1 font-medium">Нових слів на день</h2>
        <p className="mb-3 text-sm text-muted">
          Кожне нове слово дає ще ~4 повторення в наступні тижні.
        </p>
        <Segmented
          label="Нових слів на день"
          value={settings.dailyNew}
          options={LIMITS}
          onChange={(dailyNew) => update({ dailyNew })}
        />
      </Card>

      <Card className="flex flex-col gap-2">
        {speech ? (
          <Toggle
            label="Автоозвучка"
            hint="Вимовляти слово, коли воно зʼявляється"
            checked={settings.autoSpeak}
            onChange={(autoSpeak) => update({ autoSpeak })}
          />
        ) : (
          <p className="text-sm text-muted">Озвучка недоступна в цьому браузері.</p>
        )}
        <Toggle
          label="Контрольне повторення"
          hint="Перевірити вивчені слова ще раз через 60 днів"
          checked={settings.controlReview}
          onChange={(controlReview) => update({ controlReview })}
        />
      </Card>

      <Card>
        <h2 className="mb-3 font-medium">Тема</h2>
        <Segmented
          label="Тема"
          value={settings.theme}
          options={THEMES}
          onChange={(theme) => update({ theme })}
        />
      </Card>

      <SyncCard />
      <ReminderCard />
      <BackupCard />

      <Card>
        <h2 className="font-medium">Скидання</h2>
        <p className="mt-1 text-sm text-muted">
          Прогрес зберігається на цьому пристрої після кожної відповіді. Скидання синхронізується на
          інші пристрої.
        </p>
        <Button variant="danger" className="mt-3" onClick={reset}>
          Скинути прогрес
        </Button>
      </Card>

      <Button variant="ghost" onClick={() => navigate('/guide')}>
        Як вчитися з найбільшим ефектом →
      </Button>

      <p className="text-center text-xs text-muted">
        NGSL Trainer · 2801 слово ·{' '}
        <a className="underline" href="https://github.com/vitaliipavlysh-creator/ngsl-trainer">
          GitHub
        </a>
      </p>
    </div>
  );
}
