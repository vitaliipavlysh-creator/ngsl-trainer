import { useStore } from 'zustand';
import { appStore } from '../store/store';
import { githubGistApi } from './gist';
import { createSync, type SyncConfig, type SyncStatus } from './sync';

const CONFIG_KEY = 'ngsl-sync';

function loadConfig(): SyncConfig | null {
  try {
    const text = localStorage.getItem(CONFIG_KEY);
    return text ? (JSON.parse(text) as SyncConfig) : null;
  } catch {
    return null;
  }
}

function saveConfig(config: SyncConfig | null): void {
  try {
    if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    else localStorage.removeItem(CONFIG_KEY);
  } catch {
    // Без localStorage синхронізація просто не запамʼятається між запусками.
  }
}

export const sync = createSync({
  store: appStore,
  makeApi: (token, profile) => githubGistApi(token, profile),
  loadConfig,
  saveConfig,
});

export function useSync<T>(selector: (s: SyncStatus) => T): T {
  return useStore(sync.status, selector);
}
