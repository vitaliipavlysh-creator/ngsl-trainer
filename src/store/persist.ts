import type { AppState } from '../core/types';
import { initialState, migrate } from './state';
import type { AppStore } from './store';

const KEY = 'ngsl-state';

/**
 * Стан зберігається в localStorage синхронно після кожної зміни:
 * відповідь не загубиться, навіть якщо закрити вкладку одразу після неї.
 * Розмір стану — до ~200 КБ, ліміт localStorage — 5 МБ.
 */
function readRaw(): unknown {
  const text = localStorage.getItem(KEY);
  return text ? JSON.parse(text) : undefined;
}

export function saveState(state: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function loadState(): AppState | null {
  return migrate(readRaw());
}

/**
 * Завантажує збережений стан і далі зберігає кожну зміну.
 * Якщо дані не вдалося прочитати — не перезаписуємо їх і повертаємо помилку.
 */
export function initPersistence(store: AppStore): Error | null {
  let saved: AppState | null;
  try {
    saved = loadState();
  } catch (e) {
    store.getState().hydrate(initialState());
    return e instanceof Error ? e : new Error(String(e));
  }
  store.getState().hydrate(saved ?? initialState());
  void navigator.storage?.persist?.().catch(() => false);

  store.subscribe((state, prev) => {
    if (state.app === prev.app) return;
    try {
      saveState(state.app);
    } catch (e) {
      console.error('Не вдалося зберегти прогрес', e);
    }
  });

  // Зміни з іншої вкладки: підтягуємо, якщо зараз немає активної сесії.
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || store.getState().session) return;
    try {
      const fresh = loadState();
      if (fresh && fresh.updatedAt > store.getState().app.updatedAt)
        store.getState().hydrate(fresh);
    } catch {
      // Пошкоджені чужі дані ігноруємо — наш стан лишається.
    }
  });
  return null;
}
