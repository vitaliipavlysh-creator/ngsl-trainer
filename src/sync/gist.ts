/** Файл із прогресом у секретному Gist. */
export const GIST_FILE = 'ngsl-trainer-progress.json';
const DESCRIPTION = 'NGSL Trainer — прогрес (синхронізується автоматично, не редагуй вручну)';
const API = 'https://api.github.com';

/** Мінімальний інтерфейс сховища — для тестів його підміняє фейк. */
export interface GistApi {
  /** Шукає Gist із файлом прогресу серед Gist користувача. */
  find(): Promise<string | null>;
  create(content: string): Promise<string>;
  /** `null` — Gist або файл видалено. */
  read(id: string): Promise<string | null>;
  write(id: string, content: string): Promise<void>;
}

export type SyncErrorKind = 'auth' | 'permission' | 'rate' | 'network' | 'server';

export class SyncError extends Error {
  constructor(
    readonly kind: SyncErrorKind,
    message: string,
  ) {
    super(message);
  }
}

interface GistFile {
  content?: string;
  truncated?: boolean;
  raw_url?: string;
}
interface Gist {
  id: string;
  files: Record<string, GistFile | null>;
}

export function githubGistApi(token: string, fetchFn: typeof fetch = fetch): GistApi {
  async function request<T>(
    path: string,
    init: RequestInit = {},
    allow404 = false,
  ): Promise<T | null> {
    let res: Response;
    try {
      res = await fetchFn(`${API}${path}`, {
        ...init,
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });
    } catch {
      throw new SyncError('network', 'Немає зʼєднання — синхронізую, щойно зʼявиться мережа.');
    }
    if (res.ok) return (await res.json()) as T;
    if (res.status === 404 && allow404) return null;
    if (res.status === 401) {
      throw new SyncError('auth', 'Токен недійсний або прострочений — створи новий.');
    }
    if (res.status === 403 || res.status === 429) {
      if (res.headers.get('x-ratelimit-remaining') === '0' || res.status === 429) {
        throw new SyncError('rate', 'GitHub тимчасово обмежив запити — спробую пізніше.');
      }
      throw new SyncError('permission', 'Токену бракує дозволу «Gists: Read and write».');
    }
    if (res.status === 404) {
      throw new SyncError('permission', 'Токену бракує дозволу «Gists: Read and write».');
    }
    throw new SyncError('server', `GitHub відповів помилкою ${res.status} — спробую пізніше.`);
  }

  return {
    async find() {
      for (let page = 1; page <= 10; page++) {
        const gists = (await request<Gist[]>(`/gists?per_page=100&page=${page}`)) ?? [];
        const hit = gists.find((g) => GIST_FILE in g.files);
        if (hit) return hit.id;
        if (gists.length < 100) break;
      }
      return null;
    },

    async create(content) {
      const gist = await request<Gist>('/gists', {
        method: 'POST',
        body: JSON.stringify({
          description: DESCRIPTION,
          public: false,
          files: { [GIST_FILE]: { content } },
        }),
      });
      if (!gist) throw new SyncError('server', 'Не вдалося створити Gist.');
      return gist.id;
    },

    async read(id) {
      const gist = await request<Gist>(`/gists/${id}`, {}, true);
      const file = gist?.files[GIST_FILE];
      if (!file) return null;
      if (!file.truncated) return file.content ?? null;
      // Файли понад 1 МБ API обрізає — тоді беремо повний вміст за raw_url.
      try {
        const raw = await fetchFn(file.raw_url as string, { cache: 'no-store' });
        return raw.ok ? await raw.text() : null;
      } catch {
        throw new SyncError('network', 'Немає зʼєднання — синхронізую, щойно зʼявиться мережа.');
      }
    },

    async write(id, content) {
      await request(`/gists/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ files: { [GIST_FILE]: { content } } }),
      });
    },
  };
}
