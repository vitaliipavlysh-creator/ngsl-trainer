import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const TOKEN = 'github_pat_test';
const FILE = 'ngsl-trainer-progress.json';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, accept, x-github-api-version',
  'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
};

/** Імітація GitHub Gist API, спільна для всіх контекстів тесту. */
async function mockGitHub(context: BrowserContext, gists: Map<string, string>) {
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
    const gistFiles = (id: string) => ({
      id,
      files: { [FILE]: { content: gists.get(id), truncated: false } },
    });
    if (url.pathname === '/gists' && req.method() === 'GET') {
      return json(200, [...gists.keys()].map(gistFiles));
    }
    if (url.pathname === '/gists' && req.method() === 'POST') {
      const id = `gist${gists.size + 1}`;
      gists.set(id, req.postDataJSON().files[FILE].content);
      return json(201, gistFiles(id));
    }
    const id = url.pathname.split('/')[2] ?? '';
    if (!gists.has(id)) return json(404, { message: 'Not Found' });
    if (req.method() === 'PATCH') gists.set(id, req.postDataJSON().files[FILE].content);
    return json(200, gistFiles(id));
  });
}

async function connect(page: Page, token = TOKEN) {
  await page.goto('./#/settings');
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

test('синхронізація: телефон → Gist → ПК', async ({ browser, baseURL }) => {
  const gists = new Map<string, string>();
  const phoneCtx = await browser.newContext({ baseURL, serviceWorkers: 'block' });
  const pcCtx = await browser.newContext({ baseURL, serviceWorkers: 'block' });
  await mockGitHub(phoneCtx, gists);
  await mockGitHub(pcCtx, gists);
  const phone = await phoneCtx.newPage();
  const pc = await pcCtx.newPage();

  await connect(phone);
  await expect(phone.getByText('Синхронізовано щойно')).toBeVisible();
  expect(gists.size).toBe(1);

  await sortBlock1(phone, [10, 11, 12]);
  await phone.goto('./#/settings');
  await phone.getByRole('button', { name: 'Синхронізувати зараз' }).click();
  await expect(phone.getByText('Синхронізовано щойно')).toBeVisible();
  await expect
    .poll(() => Object.keys(JSON.parse(gists.get('gist1') ?? '{}').words ?? {}).length)
    .toBe(50);

  await connect(pc);
  await expect(pc.getByText('Синхронізовано щойно')).toBeVisible();
  await pc.goto('./#/');
  await expect(pc.getByText('у черзі: 3')).toBeVisible();
  expect(gists.size).toBe(1);

  await phoneCtx.close();
  await pcCtx.close();
});

test('неправильний токен — зрозуміла помилка', async ({ page, context }) => {
  await mockGitHub(context, new Map());
  await connect(page, 'wrong');
  await expect(page.getByRole('alert')).toHaveText(/Токен недійсний/);
  await expect(page.getByRole('button', { name: 'Підключити' })).toBeVisible();
});

test('резервна копія: зберегти файл і відновити на іншому пристрої', async ({
  browser,
  baseURL,
}) => {
  const a = await browser.newContext({ baseURL, serviceWorkers: 'block' });
  const b = await browser.newContext({ baseURL, serviceWorkers: 'block' });
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
