import { expect, test, type Page } from '@playwright/test';

const DAY1 = new Date('2026-10-01T10:00:00');
const DAY2 = new Date('2026-10-02T10:00:00');

const tiles = (page: Page) => page.locator('ul[aria-label^="Слова блоку"] button');

async function sortBlock1(page: Page, unknown: number[]) {
  await page.goto('./#/sort/1');
  for (const i of unknown) await tiles(page).nth(i).click();
  await page.getByRole('button', { name: 'Зберегти блок' }).click();
  await expect(page).toHaveURL(/#\/sort\/2$/);
}

/** Проходить сесію до кінця: «Далі» на знайомстві, «Показати» → «Згадав» на перевірці. */
async function finishSession(page: Page) {
  const buttons = page.locator('footer button');
  for (let i = 0; i < 60; i++) {
    await expect(buttons.first()).toBeVisible();
    const labels = await buttons.allInnerTexts();
    const pick = ['Згадав', 'Далі', 'Показати'].find((l) =>
      labels.some((t) => t.trim().startsWith(l)),
    );
    if (!pick) return;
    await buttons
      .filter({ hasText: new RegExp(`^${pick}`) })
      .first()
      .click();
  }
}

test('перший запуск: підказка почати з блоку 1, без горизонтального скролу', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Почнімо!' })).toBeVisible();
  await expect(page.getByText('Не відсортовано2801')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test('повний цикл: сортування → вивчення → повторення наступного дня', async ({ page }) => {
  await page.clock.setFixedTime(DAY1);
  await sortBlock1(page, [20, 25, 30, 35, 40, 45]);

  await page.goto('./#/');
  await expect(page.getByText('у черзі: 6')).toBeVisible();
  await page.getByRole('button', { name: 'Вчити 6 слів' }).click();
  await expect(page).toHaveURL(/#\/learn$/);
  await finishSession(page);
  await expect(page.getByRole('heading', { name: 'нових слів у вивченні' })).toBeVisible();

  // Прогрес переживає перезавантаження.
  await page.goto('./#/');
  await page.reload();
  await expect(page.getByText('6 з 15 на сьогодні')).toBeVisible();
  await expect(page.getByText('Наступне — завтра: 6 слів.')).toBeVisible();

  await page.clock.setFixedTime(DAY2);
  await page.reload();
  await expect(page.getByText('6 слів на сьогодні')).toBeVisible();
  await page.getByRole('button', { name: 'Повторити' }).click();
  await expect(page.getByText('Етап 1')).toBeVisible();
  await page.getByRole('button', { name: 'Показати' }).click();
  await page.getByRole('button', { name: /^Забув/ }).click();
  await finishSession(page);
  await expect(page.getByRole('heading', { name: 'Повторення завершено' })).toBeVisible();

  await page.getByRole('button', { name: 'На головну' }).click();
  await expect(page.getByText(/Наступне — завтра: 1 слово/)).toBeVisible();
});

test('скасування відповіді повертає картку', async ({ page }) => {
  await sortBlock1(page, [20, 21]);
  await page.goto('./#/');
  await page.getByRole('button', { name: 'Вчити 2 слова' }).click();
  await page.getByRole('button', { name: 'Далі', exact: true }).click();
  await page.getByRole('button', { name: 'Далі', exact: true }).click();
  const translation = await page.locator('main p').first().textContent();
  await page.getByRole('button', { name: 'Показати' }).click();
  await page.getByRole('button', { name: /^Згадав/ }).click();
  await expect(page.locator('main p').first()).not.toHaveText(translation ?? '');
  await page.getByRole('button', { name: 'Скасувати відповідь (U)' }).click();
  await expect(page.locator('main p').first()).toHaveText(translation ?? '');
  await expect(page.getByText('0/2')).toBeVisible();
});

test('сесія повністю проходиться з клавіатури', async ({ page }) => {
  await sortBlock1(page, [30, 31, 32]);
  await page.goto('./#/');
  await page.getByRole('button', { name: 'Вчити 3 слова' }).click();
  await expect(page.getByText('Нове слово')).toBeVisible();
  for (let i = 0; i < 3; i++) await page.keyboard.press('Space');
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Enter');
    await page.keyboard.press('Digit2');
  }
  await expect(page.getByRole('heading', { name: 'нові слова у вивченні' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#\/$/);
});

test('темна тема з налаштувань', async ({ page }) => {
  await page.goto('./#/settings');
  await page.getByRole('radio', { name: 'Темна', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
