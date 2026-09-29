import { speak, useSpeechAvailable, RATE_WORD } from '../lib/speech';
import { SpeakerIcon } from './icons';

export function SpeakButton({
  text,
  rate = RATE_WORD,
  label = 'Озвучити',
  className = '',
}: {
  text: string;
  rate?: number;
  label?: string;
  className?: string;
}) {
  const available = useSpeechAvailable();
  if (!available) return null;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => speak(text, rate)}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg ${className}`}
    >
      <SpeakerIcon width={22} height={22} />
    </button>
  );
}
