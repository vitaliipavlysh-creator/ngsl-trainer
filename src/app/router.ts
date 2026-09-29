import { useSyncExternalStore } from 'react';

/** Маршрутизація через hash (`#/sort/3`) — працює на GitHub Pages без налаштувань сервера. */
function getPath(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, getPath, () => '/');
}

export function navigate(path: string, { replace = false } = {}): void {
  if (getPath() === path) return;
  if (replace) {
    window.history.replaceState(null, '', `#${path}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = path;
  }
  window.scrollTo(0, 0);
}
