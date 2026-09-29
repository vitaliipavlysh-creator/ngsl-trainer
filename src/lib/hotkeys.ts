import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Гарячі клавіші за `KeyboardEvent.code` (працюють і в українській розкладці):
 * `Space`, `Enter`, `Escape`, `Digit1`, `KeyU`...
 */
export function useHotkeys(handlers: Record<string, (() => void) | undefined>): void {
  const ref = useRef(handlers);
  useLayoutEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const code = e.code.replace(/^Numpad(\d)$/, 'Digit$1').replace('NumpadEnter', 'Enter');
      const handler = ref.current[code];
      if (!handler) return;
      e.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
