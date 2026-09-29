import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const TOKEN = 'github_pat_test';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, accept, x-github-api-version',
  'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
};

interface StoredGist {
  file: string;
  content: string;
}

/** Імітація GitHub Gist API, спільна для всіх контекстів тесту (один акаунт). */
async function mockGitHub(context: BrowserContext, gists: Map<string, StoredGist>) {
  await context.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        headers: CORS,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (req.headers()['authorization'] !== `Bearer ${TOKEN}`) {
      return json(401, { message: 'Bad credentials' });
    }
    const view = (id: string) => {
      const g = gists.get(id) as StoredGist;
      return { id, files: { [g.file]: { content: g.content, truncated: false } } };
    };
    const incoming = () => {
      const [file, body] = Object.entries(req.postDataJSON().files)[0] as [
        string,
        { content: string },
      ];
      return { file, content: body.content };
    };
    if (url.pathname === '/gists' && req.method() === 'GET') {
      return json(200, [...gists.keys()].map(view));
    }
    if (url.pathname === '/gists' && req.method() === 'POST') {
      const id = `gist${gists.size + 1}`;
      gists.set(id, incoming());
      return json(201, view(id));
    }
    const id = url.pathname.split('/')[2] ?? '';
    if (!gists.has(id)) return json(404, { message: 'Not Found' });
    if (req.method() === 'PATCH') gists.set(id, incoming());
    return json(200, view(id));
  });
}

async function connect(page: Page, profile: string, token = TOKEN) {
  await page.goto('./#/settings');
  await page.getByLabel('Імʼя профілю').fill(profile);
  await page.getByLabel('Токен GitHub').fill(token);
  await page.getByRole('button', { name: 'Підключити' }).click();
}

async function sortBlock1(page: Page, unknown: number[]) {
  await page.goto('./#/sort/1');
  const tiles = page.locator('ul[aria-label^="Слова блоку"] button');
  for (const i of unknown) await tiles.nth(i).click();
  await page.getByRole('button', { name: 'Зберегти блок' }).click();
  await expect(page).toHaveURL(/#\/sort\/2$/);
}

test('синхронізація: телефон → Gist → ПК, окремий профіль Анни', async ({ browser, baseURL }) => {
  const gists = new Map<string, StoredGist>();
  const phoneCtx = await browser.newContext({
    baseURL,
    serviceWorkers: 'block',
  });
  const pcCtx = await browser.newContext({
    baseURL,
    serviceWorkers: 'block',
  });
  await mockGitHub(phoneCtx, gists);
  await mockGitHub(pcCtx, gists);
  // Headless Chromium не підтримує сповіщень — імітуємо стан «ще не питали», як на телефоні.
  await pcCtx.addInitScript(() =>
    Object.defineProperty(Notification, 'permission', { get: () => 'default' }),
  );
  const phone = await phoneCtx.newPage();
  const pc = await pcCtx.newPage();

  await connect(phone, 'Віталій');
  await expect(phone.getByText('Синхронізовано щойно')).toBeVisible();
  expect(gists.size).toBe(1);

  await sortBlock1(phone, [10, 11, 12]);
  await phone.goto('./#/settings');
  await phone.getByRole('button', { name: 'Синхронізувати зараз' }).click();
  await expect(phone.getByText('Синхронізовано щойно')).toBeVisible();
  await expect
    .poll(() => Object.keys(JSON.parse(gists.get('gist1')?.content ?? '{}').words ?? {}).length)
    .toBe(50);
  expect(gists.get('gist1')?.file).toBe('ngsl-trainer-progress-vitalii.json');

  await connect(pc, 'віталій');
  await expect(pc.getByText('Синхронізовано щойно')).toBeVisible();
  // Після підключення синхронізації зʼявляється перемикач нагадувань.
  await expect(pc.getByRole('switch', { name: /Щоденне нагадування/ })).toBeVisible();
  await expect(pc.getByLabel('Час нагадування')).toHaveValue('21');
  await pc.goto('./#/');
  await expect(pc.getByText('у черзі: 3')).toBeVisible();
  expect(gists.size).toBe(1);

  // Анна з тим самим токеном, але своїм профілем — свій Gist і порожній прогрес.
  const annaCtx = await browser.newContext({
    baseURL,
    serviceWorkers: 'block',
  });
  await mockGitHub(annaCtx, gists);
  const anna = await annaCtx.newPage();
  await connect(anna, 'Анна');
  await expect(anna.getByText('Синхронізовано щойно')).toBeVisible();
  await expect(anna.getByText('Профіль: Анна')).toBeVisible();
  await anna.goto('./#/');
  await expect(anna.getByRole('heading', { name: 'Почнімо!' })).toBeVisible();
  expect([...gists.values()].map((g) => g.file).sort()).toEqual([
    'ngsl-trainer-progress-anna.json',
    'ngsl-trainer-progress-vitalii.json',
  ]);
  await annaCtx.close();

  await phoneCtx.close();
  await pcCtx.close();
});

test('неправильний токен — зрозуміла помилка', async ({ page, context }) => {
  await mockGitHub(context, new Map<string, StoredGist>());
  await connect(page, 'Анна', 'wrong');
  await expect(page.getByRole('alert')).toHaveText(/Токен недійсний/);
  await expect(page.getByRole('button', { name: 'Підключити' })).toBeVisible();
});

test('резервна копія: зберегти файл і відновити на іншому пристрої', async ({
  browser,
  baseURL,
}) => {
  const a = await browser.newContext({
    baseURL,
    serviceWorkers: 'block',
  });
  const b = await browser.newContext({
    baseURL,
    serviceWorkers: 'block',
  });
  const pageA = await a.newPage();
  const pageB = await b.newPage();

  await sortBlock1(pageA, [5, 6, 7, 8]);
  await pageA.goto('./#/settings');
  const [download] = await Promise.all([
    pageA.waitForEvent('download'),
    pageA.getByRole('button', { name: 'Зберегти копію' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^ngsl-progress-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();

  await pageB.goto('./#/settings');
  await pageB.getByLabel('Файл резервної копії').setInputFiles(path);
  await expect(pageB.getByText('статуси 50 слів')).toBeVisible();
  await pageB.getByRole('button', { name: 'Обʼєднати' }).click();
  await pageB.goto('./#/');
  await expect(pageB.getByText('у черзі: 4')).toBeVisible();

  await a.close();
  await b.close();
});
