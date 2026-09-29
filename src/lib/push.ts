import type { PushSub } from '../core/reminder';
import { isIos, isStandalone } from './install';
import { VAPID_PUBLIC_KEY } from './vapid';

export type PushAvailability = 'ok' | 'unsupported' | 'ios-install' | 'denied';

export function pushAvailability(): PushAvailability {
  const supported =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  // На iPhone пуші працюють лише у встановленому на головний екран застосунку (iOS 16.4+).
  if (isIos() && !isStandalone()) return 'ios-install';
  if (!supported) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'ok';
}

function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function toSub(sub: PushSubscription): PushSub {
  const json = sub.toJSON();
  return { endpoint: json.endpoint ?? sub.endpoint, keys: json.keys as PushSub['keys'] };
}

/** Поточна підписка цього пристрою, якщо є. */
export async function currentSubscription(): Promise<PushSub | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? toSub(sub) : null;
}

/** Просить дозвіл і підписує пристрій. Викликати з обробника тапу (вимога iOS). */
export async function subscribePush(): Promise<PushSub> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Сповіщення не дозволено. Увімкни їх у налаштуваннях браузера чи телефону.');
  }
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY),
    }));
  return toSub(sub);
}

export async function unsubscribePush(): Promise<PushSub | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return null;
  const data = toSub(sub);
  await sub.unsubscribe();
  return data;
}
