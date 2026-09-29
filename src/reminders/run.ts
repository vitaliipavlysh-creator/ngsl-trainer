import { planReminder, type PushSub, type ReminderFile } from '../core/reminder';
import type { AppState } from '../core/types';
import { migrate } from '../store/state';

export const PROGRESS_PREFIX = 'ngsl-trainer-progress';
export const REMINDER_RE = /^ngsl-trainer-push(?:-(.+))?\.json$/;

/** Gist акаунта з уже завантаженим вмістом файлів. */
export interface LoadedGist {
  id: string;
  files: Record<string, string>;
}

export interface RunDeps {
  gists: LoadedGist[];
  send: (sub: PushSub, payload: string) => Promise<void>;
  writeFile: (gistId: string, name: string, content: string) => Promise<void>;
  now: Date;
  force?: boolean;
  log?: (line: string) => void;
}

/** Помилка web-push зі статусом: 404/410 — підписка більше не існує. */
function isGone(e: unknown): boolean {
  const status = (e as { statusCode?: number }).statusCode;
  return status === 404 || status === 410;
}

function parseProgress(text: string | undefined): AppState | null {
  if (!text) return null;
  try {
    return migrate(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Надсилає нагадування всім профілям, у яких настав їхній час. */
export async function runReminders(deps: RunDeps): Promise<{ sent: number; removed: number }> {
  const log = deps.log ?? (() => undefined);
  let sent = 0;
  let removed = 0;

  for (const gist of deps.gists) {
    for (const [name, text] of Object.entries(gist.files)) {
      if (!REMINDER_RE.test(name)) continue;
      let file: ReminderFile;
      try {
        file = JSON.parse(text) as ReminderFile;
      } catch {
        log(`${name}: пошкоджений файл, пропускаю`);
        continue;
      }
      const progressName = Object.keys(gist.files).find((n) => n.startsWith(PROGRESS_PREFIX));
      const message = planReminder(
        file,
        parseProgress(progressName && gist.files[progressName]),
        deps.now,
        deps.force,
      );
      if (!message) {
        log(`${name}: не зараз`);
        continue;
      }

      const alive: PushSub[] = [];
      for (const sub of file.subscriptions) {
        try {
          await deps.send(sub, JSON.stringify(message));
          alive.push(sub);
          sent++;
        } catch (e) {
          if (isGone(e)) removed++;
          else {
            alive.push(sub);
            log(`${name}: помилка надсилання — ${(e as Error).message}`);
          }
        }
      }
      if (alive.length !== file.subscriptions.length) {
        const updated: ReminderFile = { ...file, subscriptions: alive, enabled: alive.length > 0 };
        await deps.writeFile(gist.id, name, JSON.stringify(updated));
      }
      log(`${name}: надіслано «${message.body}»`);
    }
  }
  return { sent, removed };
}
