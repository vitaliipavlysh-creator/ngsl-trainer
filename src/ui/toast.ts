import { create } from 'zustand';

export const useToastStore = create<{ message: string | null; id: number }>(() => ({
  message: null,
  id: 0,
}));

export function showToast(message: string): void {
  useToastStore.setState((s) => ({ message, id: s.id + 1 }));
}

export function hideToast(): void {
  useToastStore.setState({ message: null });
}
