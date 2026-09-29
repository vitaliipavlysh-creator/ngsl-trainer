import { createStore } from 'zustand/vanilla';
import { fingerprint, mergeStates } from '../core/merge';
import type { AppState } from '../core/types';
import { migrate } from '../store/state';
import type { AppStore } from '../store/store';
import { SyncError, type GistApi, type SyncErrorKind } from './gist';

/** Затримка відправки після змін — щоб не смикати GitHub на кожну відповідь. */
export const PUSH_DELAY = 5_000;

export interface SyncConfig {
  token: string;
  gistId: string | null;
  lastSyncAt?: number;
}

export type SyncState = 'off' | 'idle' | 'syncing' | 'error';

export interface SyncStatus {
  state: SyncState;
  lastSyncAt: number | null;
  error: string | null;
  errorKind: SyncErrorKind | null;
  gistId: string | null;
}

export interface SyncDeps {
  store: AppStore;
  makeApi: (token: string) => GistApi;
  loadConfig: () => SyncConfig | null;
  saveConfig: (config: SyncConfig | null) => void;
  now?: () => number;
}

function parseRemote(text: string): AppState | null {
  try {
    return migrate(JSON.parse(text));
  } catch (e) {
    const reason = e instanceof SyntaxError ? 'пошкоджений' : (e as Error).message;
    throw new SyncError('server', `Прогрес у Gist не прочитати (${reason}).`);
  }
}

/**
 * Синхронізація через секретний GitHub Gist:
 * читаємо віддалений стан → зливаємо з локальним → застосовуємо → відправляємо, якщо є що.
 */
export function createSync(deps: SyncDeps) {
  const now = deps.now ?? (() => Date.now());
  let config = deps.loadConfig();
  let running: Promise<void> | null = null;
  let again = false;
  let dirty = false;
  let applyingRemote = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const status = createStore<SyncStatus>(() => ({
    state: config ? 'idle' : 'off',
    lastSyncAt: config?.lastSyncAt ?? null,
    error: null,
    errorKind: null,
    gistId: config?.gistId ?? null,
  }));

  async function syncOnce(cfg: SyncConfig): Promise<void> {
    const api = deps.makeApi(cfg.token);
    dirty = false;

    let id = cfg.gistId;
    let remoteText: string | null = null;
    if (id) {
      remoteText = await api.read(id);
      if (remoteText === null) id = null; // Gist видалили — знайдемо інший або створимо новий.
    }
    if (!id) {
      id = await api.find();
      if (id) remoteText = await api.read(id);
    }
    const remote = remoteText ? parseRemote(remoteText) : null;

    // Між читанням локального стану й застосуванням немає await — чужі зміни не перетремо.
    const { app, session } = deps.store.getState();
    const merged = remote ? mergeStates(app, remote) : app;
    // Під час сесії не підміняємо слова під ногами — застосуємо після її завершення.
    if (!session && fingerprint(merged) !== fingerprint(app)) {
      applyingRemote = true;
      try {
        deps.store.getState().hydrate(merged);
      } finally {
        applyingRemote = false;
      }
    }

    if (!remote || fingerprint(merged) !== fingerprint(remote)) {
      const content = JSON.stringify(merged);
      if (id) await api.write(id, content);
      else id = await api.create(content);
    }

    if (config?.token !== cfg.token) return; // Відключили під час синхронізації.
    const lastSyncAt = now();
    config = { ...cfg, gistId: id, lastSyncAt };
    deps.saveConfig(config);
    status.setState({ state: 'idle', lastSyncAt, error: null, errorKind: null, gistId: id });
  }

  function schedule(delay = PUSH_DELAY): void {
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), delay);
  }

  function syncNow(): Promise<void> {
    const cfg = config;
    if (!cfg) return Promise.resolve();
    if (running) {
      again = true;
      return running;
    }
    clearTimeout(timer);
    status.setState({ state: 'syncing' });
    running = (async () => {
      try {
        await syncOnce(cfg);
      } catch (e) {
        if (config) {
          const kind = e instanceof SyncError ? e.kind : 'server';
          status.setState({ state: 'error', error: (e as Error).message, errorKind: kind });
        }
      } finally {
        running = null;
      }
      if (again) {
        again = false;
        void syncNow();
      } else if (dirty && config) {
        schedule();
      }
    })();
    return running;
  }

  /** Підключення: перевіряє токен, знаходить або створює Gist і одразу синхронізує. */
  async function connect(token: string): Promise<void> {
    const clean = token.trim();
    const gistId = await deps.makeApi(clean).find();
    config = { token: clean, gistId };
    deps.saveConfig(config);
    status.setState({ state: 'idle', error: null, errorKind: null, gistId, lastSyncAt: null });
    await syncNow();
    const { state, error, errorKind } = status.getState();
    if (state === 'error') {
      // Перша синхронізація не вдалась (напр., токен без права запису) — відкочуємо підключення.
      disconnect();
      throw new SyncError(errorKind ?? 'server', error ?? 'Не вдалося синхронізувати.');
    }
  }

  /** Відключає цей пристрій. Gist і прогрес у ньому лишаються. */
  function disconnect(): void {
    config = null;
    clearTimeout(timer);
    deps.saveConfig(null);
    status.setState({ state: 'off', lastSyncAt: null, error: null, errorKind: null, gistId: null });
  }

  /** Автоматичні тригери: зміни прогресу, повернення на вкладку, мережа. */
  function start(): void {
    deps.store.subscribe((s, prev) => {
      if (!config) return;
      if (s.app !== prev.app && !applyingRemote) {
        dirty = true;
        schedule();
      }
      if (prev.session && !s.session) schedule(1_000);
    });
    document.addEventListener('visibilitychange', () => {
      if (!config) return;
      // Повернулись — підтягуємо; згорнули — відправляємо, якщо є зміни.
      if (document.visibilityState === 'visible' || dirty) void syncNow();
    });
    window.addEventListener('online', () => void syncNow());
    void syncNow();
  }

  return {
    status,
    syncNow,
    connect,
    disconnect,
    start,
    isConnected: () => config !== null,
  };
}

export type SyncEngine = ReturnType<typeof createSync>;
