const percent = new Intl.NumberFormat('uk', { maximumFractionDigits: 1 });

/** 34,5 % */
export function formatPercent(value: number): string {
  return `${percent.format(value)} %`;
}

/** Безпечне читання localStorage (приватний режим, заблоковані дані). */
export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Не критично: це лише зручність.
  }
}
