import { useEffect, useState } from 'react';
import { dayNumber } from '../core/dates';

/** Поточний навчальний день; оновлюється щохвилини і при поверненні на вкладку. */
export function useDay(): number {
  const [day, setDay] = useState(() => dayNumber());
  useEffect(() => {
    const update = () => setDay(dayNumber());
    const id = window.setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return day;
}
