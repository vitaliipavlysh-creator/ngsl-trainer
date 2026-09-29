import { useSyncExternalStore } from 'react';

/** Швидкість озвучки слова і прикладу. */
export const RATE_WORD = 0.9;
export const RATE_EXAMPLE = 0.85;

const synth =
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
const PREFERRED = /Google US English|Samantha|Aria|Jenny|Natural|Enhanced|Premium/i;
const listeners = new Set<() => void>();
let voice: SpeechSynthesisVoice | null = null;
let unlocked = false;

const isEnUs = (v: SpeechSynthesisVoice) => /^en[-_]us$/i.test(v.lang);

function pickVoice() {
  if (!synth) return;
  const en = synth.getVoices().filter((v) => /^en([-_]|$)/i.test(v.lang));
  const us = en.filter(isEnUs);
  voice =
    us.find((v) => PREFERRED.test(v.name)) ??
    us.find((v) => !v.localService) ??
    us[0] ??
    en[0] ??
    null;
  listeners.forEach((l) => l());
}

if (synth) {
  pickVoice();
  synth.addEventListener?.('voiceschanged', pickVoice);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Чи є англійський голос. Якщо немає — кнопки озвучки ховаються. */
export function useSpeechAvailable(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => voice !== null,
    () => false,
  );
}

export function speak(text: string, rate = RATE_WORD): void {
  if (!synth || !voice) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = rate;
  synth.speak(u);
}

/** iOS дозволяє автоозвучку лише після озвучки, запущеної тапом. Викликати в обробнику тапу. */
export function unlockSpeech(): void {
  if (!synth || unlocked) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  synth.speak(u);
  unlocked = true;
}
