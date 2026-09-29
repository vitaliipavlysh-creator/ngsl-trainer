import { useEffect } from 'react';
import { useToastStore } from './toast';

export function Toaster() {
  const { message, id } = useToastStore();
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => useToastStore.setState({ message: null }), 3500);
    return () => window.clearTimeout(t);
  }, [message, id]);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-50 flex justify-center px-4"
    >
      {message && (
        <div
          key={id}
          className="animate-appear rounded-xl bg-fg px-4 py-3 text-sm text-bg shadow-lg"
          role="status"
        >
          {message}
        </div>
      )}
    </div>
  );
}
