import { describe, expect, it } from 'vitest';
import { initialState } from '../store/state';
import { createAppStore } from '../store/store';
import { SyncError, type GistApi } from './gist';
import { createSync, type SyncConfig } from './sync';

/** Фейковий GitHub: спільні Gist для всіх «пристроїв». */
function fakeGitHub(validToken = 'good') {
  const gists = new Map<string, string>();
  let nextId = 1;
  let writes = 0;
  const makeApi = (token: string): GistApi => {
    const check = () => {
      if (token !== validToken) throw new SyncError('auth', 'Токен недійсний');
    };
    return {
      async find() {
        check();
        return gists.keys().next().value ?? null;
      },
      async create(content) {
        check();
        const id = `g${nextId++}`;
        gists.set(id, content);
        return id;
      },
      async read(id) {
        check();
        return gists.get(id) ?? null;
      },
      async write(id, content) {
        check();
        writes++;
        gists.set(id, content);
      },
    };
  };
  return { gists, makeApi, writes: () => writes };
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

    await phone.engine.connect('good');
    expect(github.gists.size).toBe(1);
    expect(phone.config()?.gistId).toBe('g1');

    phone.get().saveBlock(1, new Set([3, 7]));
    await phone.engine.syncNow();

    await pc.engine.connect('good');
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
    await phone.engine.connect('good');
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
    await phone.engine.connect('good');
    await pc.engine.connect('good');

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
    await phone.engine.connect('good');
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
    await phone.engine.connect('good');
    github.gists.clear();
    phone.get().saveBlock(1, new Set());
    await phone.engine.syncNow();
    expect(github.gists.size).toBe(1);
    expect(phone.config()?.gistId).toBe('g2');
  });

  it('поганий токен — помилка підключення, конфіг не зберігається', async () => {
    const phone = device(fakeGitHub(), T);
    await expect(phone.engine.connect('bad')).rejects.toThrow('Токен недійсний');
    expect(phone.config()).toBeNull();
    expect(phone.engine.isConnected()).toBe(false);
  });

  it('токен без права запису — підключення відкочується', async () => {
    const github = fakeGitHub();
    const readOnly = (token: string): GistApi => ({
      ...github.makeApi(token),
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
    await expect(engine.connect('good')).rejects.toThrow('Gists: Read and write');
    expect(saved).toBeNull();
    expect(engine.status.getState().state).toBe('off');
  });

  it('помилка під час синхронізації видна в статусі', async () => {
    const github = fakeGitHub();
    const phone = device(github, T);
    await phone.engine.connect('good');
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
    await phone.engine.connect('good');
    phone.engine.disconnect();
    expect(phone.engine.status.getState().state).toBe('off');
    phone.get().saveBlock(1, new Set());
    await phone.engine.syncNow();
    expect(JSON.parse(github.gists.get('g1') as string).words).toEqual({});
  });
});
