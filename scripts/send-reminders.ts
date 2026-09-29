/**
 * Щогодинна розсилка нагадувань (GitHub Actions, .github/workflows/reminders.yml).
 * Читає Gist акаунта, надсилає Web Push профілям, у яких настав їхній час.
 * Запуск: GIST_TOKEN=… VAPID_PRIVATE_KEY=… npx tsx scripts/send-reminders.ts
 */
import webpush from 'web-push';
import { VAPID_PUBLIC_KEY, VAPID_SUBJECT } from '../src/lib/vapid';
import { REMINDER_RE, runReminders, type LoadedGist } from '../src/reminders/run';

const API = 'https://api.github.com';
const token = process.env.GIST_TOKEN;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const force = process.env.FORCE === 'true';

if (!token || !privateKey) {
  console.log('Секрети GIST_TOKEN і VAPID_PRIVATE_KEY не налаштовані — нагадування вимкнені.');
  process.exit(0);
}

async function github<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} ${path}`);
  return (await res.json()) as T;
}

interface GistSummary {
  id: string;
  files: Record<string, unknown>;
}
interface GistFull {
  id: string;
  files: Record<string, { content?: string; truncated?: boolean; raw_url?: string }>;
}

async function loadGists(): Promise<LoadedGist[]> {
  const summaries: GistSummary[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await github<GistSummary[]>(`/gists?per_page=100&page=${page}`);
    summaries.push(...batch);
    if (batch.length < 100) break;
  }
  const relevant = summaries.filter((g) => Object.keys(g.files).some((n) => REMINDER_RE.test(n)));
  const loaded: LoadedGist[] = [];
  for (const { id } of relevant) {
    const gist = await github<GistFull>(`/gists/${id}`);
    const files: Record<string, string> = {};
    for (const [name, f] of Object.entries(gist.files)) {
      if (f.truncated && f.raw_url) files[name] = await (await fetch(f.raw_url)).text();
      else if (f.content !== undefined) files[name] = f.content;
    }
    loaded.push({ id, files });
  }
  return loaded;
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, privateKey);

const result = await runReminders({
  gists: await loadGists(),
  now: new Date(),
  force,
  log: (line) => console.log(line),
  send: async (sub, payload) => {
    await webpush.sendNotification(sub, payload, { TTL: 6 * 3600, urgency: 'normal' });
  },
  writeFile: async (id, name, content) => {
    await github(`/gists/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ files: { [name]: { content } } }),
    });
  },
});
console.log(`Надіслано: ${result.sent}, прибрано прострочених підписок: ${result.removed}`);
