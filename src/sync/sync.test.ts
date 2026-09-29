import { describe, expect, it } from 'vitest';
import { initialState } from '../store/state';
import { createAppStore } from '../store/store';
import { gistFileName, profileSlug, SyncError, type GistApi } from './gist';
import { createSync, type SyncConfig } from './sync';

/** Фейковий GitHub: спільні Gist для всіх «пристроїв» одного акаунта. */
function fakeGitHub(validToken = 'good') {
  const gists = new Map<string, string>();
  const files = new Map<string, string>();
  let nextId = 1;
  let writes = 0;
  const makeApi = (token: string, profile: string): GistApi => {
    const file = gistFileName(profile);
    const check = () => {
      if (token !== validToken) throw new SyncError('auth', 'Токен недійсний');
    };
    return {
      async find() {
        check();
        return [...files].find(([, f]) => f === file)?.[0] ?? null;
      },
      async create(content) {
        check();
        const id = `g${nextId++}`;
        gists.set(id, content);
        files.set(id, file);
        return id;
      },
      async read(id) {
        check();
        return files.get(id) === file ? (gists.get(id) ?? null) : null;
      },
      async write(id, content) {
        check();
        writes++;
        gists.set(id, content);
      },
    };
  };
  const clear = () => {
    gists.clear();
    files.clear();
  };
  return { gists, files, clear, makeApi, writes: () => writes };
}

function device(github: ReturnType<typeof fakeGitHub>, start: number) {
  let now = start;
  const store = createAppStore({ clock: () => now, rng: () => 0.5 });
  store.getState().hydrate(initialState(now));
  let saved: SyncConfig | null = null;
  const engine = createSync({
    store,
    makeApi: github.makeApi,
    loadConfig: () => saved,
    saveConfig: (c) => (saved = c),
    now: () => now,
  });
  return {
    store,
    engine,
    get: () => store.getState(),
    tick: (ms = 1000) => (now += ms),
    config: () => saved,
  };
}

const T = new Date(2026, 9, 1, 10).getTime();

describe('синхронізація через Gist', () => {
  it('телефон → Gist → ПК, далі зміни офлайн на обох зливаються', async () => {
    const github = fakeGitHub();
    const phone = device(github, T);
    const pc = device(github, T);

    await phone.engine.connect('good', 'Віталій');
    expect(github.gists.size).toBe(1);
    expect(phone.config()?.gistId).toBe('g1');

    phone.get().saveBlock(1, new Set([3, 7]));
    await phone.engine.syncNow();

    await pc.engine.connect('good', 'Віталій');
    expect(pc.get().app.words[3]?.s).toBe('queued');
    expect(Object.keys(pc.get().app.words)).toHaveLength(50);

    // Обидва щось змінили, не знаючи одне про одного.
    phone.tick();
    phone.get().setWord(500, 'known');
    pc.tick(2000);
    pc.get().setWord(600, 'queue');
    pc.get().setWord(3, 'known');

    await phone.engine.syncNow();
    await pc.engine.syncNow();
    await phone.engine.syncNow();

    for (const d of [phone, pc]) {
      expect(d.get().app.words[500]?.s).toBe('known');
      expect(d.get().app.words[600]?.s).toBe('queued');
      expect(d.get().app.words[3]?.s).toBe('known');
    }
    expect(phone.engine.status.getState()).toMatchObject({ state: 'idle', error: null });
  });

  it('без змін не пише в Gist повторно', async () => {
    const github = fakeGitHub();
    const phone = device(github, T);
    await phone.engine.connect('good', 'Віталій');
    phone.get().saveBlock(1, new Set([1]));
    await phone.engine.syncNow();
    const writes = github.writes();
    await phone.engine.syncNow();
    await phone.engine.syncNow();
    expect(github.writes()).toBe(writes);
  });

  it('під час сесії не підміняє слова, але відправляє обʼєднане', async () => {
    const github = fakeGitHub();
    const phone = device(github, T);
    const pc = device(github, T);
    await phone.engine.connect('good', 'Віталій');
    await pc.engine.connect('good', 'Віталій');

    phone.get().saveBlock(1, new Set([1, 2]));
    phone.get().startLearn();
    pc.tick();
    pc.get().setWord(900, 'known');
    await pc.engine.syncNow();

    await phone.engine.syncNow();
    expect(phone.get().app.words[900]).toBeUndefined();
    const remote = JSON.parse(github.gists.get('g1') as string);
    expect(remote.words[900].s).toBe('known');
    expect(remote.words[1].s).toBe('queued');

    phone.get().endSession();
    await phone.engine.syncNow();
    expect(phone.get().app.words[900]?.s).toBe('known');
  });

  it('скасована відповідь не повертається з Gist', async () => {
    const github = fakeGitHub();
    const phone = device(github, T);
    await phone.engine.connect('good', 'Віталій');
    phone.get().saveBlock(1, new Set([1]));
    phone.get().startLearn();
    for (let i = 0; i < 1; i++) phone.get().learnNext();
    phone.tick();
    phone.get().answer(true);
    await phone.engine.syncNow();
    phone.tick();
    phone.get().undo();
    phone.get().endSession();
    await phone.engine.syncNow();
    expect(phone.get().app.words[1]?.s).toBe('queued');
    expect(JSON.parse(github.gists.get('g1') as string).words[1].s).toBe('queued');
  });

  it('видалений Gist створюється заново', async () => {
    const github = fakeGitHub();
    const phone = device(github, T);
    await phone.engine.connect('good', 'Віталій');
    github.clear();
    phone.get().saveBlock(1, new Set());
    await phone.engine.syncNow();
    expect(github.gists.size).toBe(1);
    expect(phone.config()?.gistId).toBe('g2');
  });

  it('профілі в одному акаунті: у кожного свій Gist і свій прогрес', async () => {
    const github = fakeGitHub();
    const vitalii = device(github, T);
    const anna = device(github, T);
    const annaPc = device(github, T);

    await vitalii.engine.connect('good', 'Віталій');
    vitalii.get().saveBlock(1, new Set([1, 2, 3]));
    await vitalii.engine.syncNow();

    await anna.engine.connect('good', 'Анна');
    expect(anna.get().app.words).toEqual({});
    anna.get().saveBlock(1, new Set([40]));
    await anna.engine.syncNow();

    expect(github.gists.size).toBe(2);
    expect([...github.files.values()].sort()).toEqual([
      'ngsl-trainer-progress-anna.json',
      'ngsl-trainer-progress-vitalii.json',
    ]);

    // Те саме імʼя з іншого пристрою (інший регістр і пробіли) — той самий профіль.
    await annaPc.engine.connect('good', '  анна ');
    expect(annaPc.get().app.words[40]?.s).toBe('queued');
    expect(annaPc.get().app.words[1]?.s).toBe('known');

    await vitalii.engine.syncNow();
    expect(vitalii.get().app.words[1]?.s).toBe('queued');
    expect(vitalii.get().app.words[40]?.s).toBe('known');
    expect(vitalii.engine.status.getState().profile).toBe('Віталій');
  });

  it('імʼя профілю → назва файлу', () => {
    expect(profileSlug('Віталій')).toBe('vitalii');
    expect(profileSlug('  Анна ')).toBe('anna');
    expect(profileSlug("Ольга-Марія Ґ'")).toBe('olha-mariia-g');
    expect(profileSlug('John Smith 2')).toBe('john-smith-2');
    expect(gistFileName('')).toBe('ngsl-trainer-progress.json');
  });

  it('поганий токен — помилка підключення, конфіг не зберігається', async () => {
    const phone = device(fakeGitHub(), T);
    await expect(phone.engine.connect('bad', 'Віталій')).rejects.toThrow('Токен недійсний');
    expect(phone.config()).toBeNull();
    expect(phone.engine.isConnected()).toBe(false);
  });

  it('токен без права запису — підключення відкочується', async () => {
    const github = fakeGitHub();
    const readOnly = (token: string, profile: string): GistApi => ({
      ...github.makeApi(token, profile),
      create: async () => {
        throw new SyncError('permission', 'Токену бракує дозволу «Gists: Read and write».');
      },
    });
    let saved: SyncConfig | null = null;
    const store = createAppStore();
    store.getState().hydrate(initialState(T));
    const engine = createSync({
      store,
      makeApi: readOnly,
      loadConfig: () => saved,
      saveConfig: (c) => (saved = c),
    });
    await expect(engine.connect('good', 'Віталій')).rejects.toThrow('Gists: Read and write');
    expect(saved).toBeNull();
    expect(engine.status.getState().state).toBe('off');
  });

  it('помилка під час синхронізації видна в статусі', async () => {
    const github = fakeGitHub();
    const phone = device(github, T);
    await phone.engine.connect('good', 'Віталій');
    github.gists.set('g1', '{"v": 99, "words": {}}');
    await phone.engine.syncNow();
    expect(phone.engine.status.getState().state).toBe('error');
    expect(phone.engine.status.getState().error).toMatch(/новішою версією/);
    // Нічого не перезаписали.
    expect(github.gists.get('g1')).toBe('{"v": 99, "words": {}}');
  });

  it('відключення зупиняє синхронізацію, Gist лишається', async () => {
    const github = fakeGitHub();
    const phone = device(github, T);
    await phone.engine.connect('good', 'Віталій');
    phone.engine.disconnect();
    expect(phone.engine.status.getState().state).toBe('off');
    phone.get().saveBlock(1, new Set());
    await phone.engine.syncNow();
    expect(JSON.parse(github.gists.get('g1') as string).words).toEqual({});
  });
});
