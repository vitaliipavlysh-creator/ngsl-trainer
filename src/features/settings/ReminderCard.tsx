import { useEffect, useState } from 'react';
import { DEFAULT_REMINDER_HOUR, withSubscription, type ReminderFile } from '../../core/reminder';
import {
  currentSubscription,
  pushAvailability,
  subscribePush,
  unsubscribePush,
} from '../../lib/push';
import { sync, useSync } from '../../sync';
import { Card } from '../../ui/Card';
import { showToast } from '../../ui/toast';
import { Toggle } from '../../ui/Toggle';

const HOURS = Array.from({ length: 17 }, (_, i) => i + 7); // 07:00–23:00
const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const UNAVAILABLE: Record<string, string> = {
  unsupported: 'Цей браузер не підтримує сповіщення.',
  'ios-install':
    'На iPhone нагадування працюють лише у встановленому застосунку (iOS 16.4+): у Safari — Поділитися → На початковий екран, і відкрий його з іконки.',
  denied:
    'Сповіщення заборонені. Дозволь їх для цього застосунку в налаштуваннях телефону чи браузера.',
};

export function ReminderCard() {
  const connected = useSync((s) => s.state !== 'off');
  const availability = pushAvailability();
  const [file, setFile] = useState<ReminderFile | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || availability !== 'ok') return;
    let alive = true;
    Promise.all([sync.loadReminder(), currentSubscription()])
      .then(([f, sub]) => {
        if (!alive) return;
        setFile(f);
        setEndpoint(sub?.endpoint ?? null);
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [connected, availability]);

  const hour = file?.hour ?? DEFAULT_REMINDER_HOUR;
  const on = !!endpoint && !!file?.subscriptions.some((s) => s.endpoint === endpoint);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (next: boolean) =>
    run(async () => {
      const sub = next ? await subscribePush() : await unsubscribePush();
      if (!sub) {
        setEndpoint(null);
        return;
      }
      const saved = await sync.saveReminder((cur) =>
        withSubscription(cur, sub, next, { hour, timeZone: timeZone(), now: Date.now() }),
      );
      setFile(saved);
      setEndpoint(next ? sub.endpoint : null);
      if (next) showToast(`Нагадування щодня о ${hour}:00`);
    });

  const changeHour = (h: number) =>
    run(async () => {
      const saved = await sync.saveReminder((cur) => ({
        v: 1,
        enabled: cur?.enabled ?? false,
        subscriptions: cur?.subscriptions ?? [],
        hour: h,
        timeZone: timeZone(),
        updatedAt: Date.now(),
      }));
      setFile(saved);
    });

  let content;
  if (availability === 'unsupported' || availability === 'ios-install') {
    content = <p className="mt-1 text-sm text-muted">{UNAVAILABLE[availability]}</p>;
  } else if (!connected) {
    content = (
      <p className="mt-1 text-sm text-muted">
        Нагадування надсилаються через твій Gist — спершу підключи синхронізацію вище.
      </p>
    );
  } else if (availability === 'denied') {
    content = <p className="mt-1 text-sm text-muted">{UNAVAILABLE.denied}</p>;
  } else {
    content = (
      <>
        <div className="mt-2">
          <Toggle
            label="Щоденне нагадування"
            hint="Не турбує, якщо сьогодні ти вже займався"
            checked={on}
            onChange={(v) => void toggle(v)}
          />
        </div>
        <label className="mt-3 flex min-h-11 items-center justify-between gap-3">
          <span>Час</span>
          <select
            value={hour}
            disabled={busy || !loaded}
            onChange={(e) => void changeHour(Number(e.target.value))}
            className="min-h-11 rounded-xl border border-line bg-bg px-3 font-mono"
            aria-label="Час нагадування"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs text-muted">
          Час — для всіх твоїх пристроїв у профілі. Пуш може прийти на 5–20 хвилин пізніше.
        </p>
      </>
    );
  }

  return (
    <Card>
      <h2 className="font-medium">Нагадування</h2>
      {content}
      {busy && <p className="mt-2 text-sm text-muted">Зберігаю…</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-queued">
          {error}
        </p>
      )}
    </Card>
  );
}
