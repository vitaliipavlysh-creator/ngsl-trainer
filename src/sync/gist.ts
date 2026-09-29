const API = 'https://api.github.com';

const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: 'ie',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  ї: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ь: '',
  ю: 'iu',
  я: 'ia',
  ы: 'y',
  э: 'e',
  ё: 'e',
  ъ: '',
};

/** «Віталій» → `vitalii`, « Анна » → `anna`: однакове імʼя з різних пристроїв — той самий профіль. */
export function profileSlug(profile: string): string {
  return [...profile.trim().toLowerCase()]
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Файл нагадувань профілю — лежить у Gist профілю поруч із прогресом. */
export function reminderFileName(profile: string): string {
  return `ngsl-trainer-push-${profileSlug(profile) || 'default'}.json`;
}

/** Файл прогресу профілю в секретному Gist. Без профілю — файл першої версії синхронізації. */
export function gistFileName(profile: string): string {
  const slug = profileSlug(profile);
  return slug ? `ngsl-trainer-progress-${slug}.json` : 'ngsl-trainer-progress.json';
}

/** Мінімальний інтерфейс сховища — для тестів його підміняє фейк. */
export interface GistApi {
  /** Шукає Gist із файлом прогресу серед Gist користувача. */
  find(): Promise<string | null>;
  create(content: string): Promise<string>;
  /** `null` — Gist або файл видалено. */
  read(id: string): Promise<string | null>;
  write(id: string, content: string): Promise<void>;
  /** Довільний файл у тому самому Gist (напр., налаштування нагадувань). */
  readFile(id: string, name: string): Promise<string | null>;
  writeFile(id: string, name: string, content: string): Promise<void>;
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

export function githubGistApi(
  token: string,
  profile: string,
  fetchFn: typeof fetch = fetch,
): GistApi {
  const file = gistFileName(profile);
  const description = `NGSL Trainer — прогрес${profile.trim() ? `: ${profile.trim()}` : ''} (синхронізується автоматично, не редагуй вручну)`;

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

  async function readFile(id: string, name: string): Promise<string | null> {
    const gist = await request<Gist>(`/gists/${id}`, {}, true);
    const stored = gist?.files[name];
    if (!stored) return null;
    if (!stored.truncated) return stored.content ?? null;
    // Файли понад 1 МБ API обрізає — тоді беремо повний вміст за raw_url.
    try {
      const raw = await fetchFn(stored.raw_url as string, { cache: 'no-store' });
      return raw.ok ? await raw.text() : null;
    } catch {
      throw new SyncError('network', 'Немає зʼєднання — синхронізую, щойно зʼявиться мережа.');
    }
  }

  async function writeFile(id: string, name: string, content: string): Promise<void> {
    await request(`/gists/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ files: { [name]: { content } } }),
    });
  }

  return {
    async find() {
      for (let page = 1; page <= 10; page++) {
        const gists = (await request<Gist[]>(`/gists?per_page=100&page=${page}`)) ?? [];
        const hit = gists.find((g) => file in g.files);
        if (hit) return hit.id;
        if (gists.length < 100) break;
      }
      return null;
    },

    async create(content) {
      const gist = await request<Gist>('/gists', {
        method: 'POST',
        body: JSON.stringify({
          description,
          public: false,
          files: { [file]: { content } },
        }),
      });
      if (!gist) throw new SyncError('server', 'Не вдалося створити Gist.');
      return gist.id;
    },

    readFile,
    writeFile,
    read: (id) => readFile(id, file),
    write: (id, content) => writeFile(id, file, content),
  };
}
