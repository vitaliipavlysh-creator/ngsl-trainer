import { useEffect } from 'react';
import type { Theme } from '../core/types';
import { writeLocal } from '../lib/format';

export const THEME_KEY = 'ngsl-theme';
const COLORS = { light: '#f6f5f1', dark: '#111418' } as const;

/** Ставить `data-theme` на <html>; для «системної» слідкує за налаштуванням ОС. */
export function useApplyTheme(theme: Theme): void {
  useEffect(() => {
    writeLocal(THEME_KEY, theme);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = resolved;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[resolved]);
    };
    apply();
    if (theme !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
