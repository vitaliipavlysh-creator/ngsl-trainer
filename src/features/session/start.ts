import { navigate } from '../../app/router';
import { unlockSpeech } from '../../lib/speech';
import { appStore } from '../../store/store';
import { hideToast } from '../../ui/toast';

export function startReview(): void {
  unlockSpeech();
  hideToast();
  if (appStore.getState().startReview()) navigate('/review');
}

/** `extra` — «Ще 5 слів» понад денний ліміт. */
export function startLearn(extra = false): void {
  unlockSpeech();
  hideToast();
  if (appStore.getState().startLearn(extra)) navigate('/learn');
}

export function exitSession(): void {
  appStore.getState().endSession();
  navigate('/');
}
