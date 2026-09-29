import { expect, test } from '@playwright/test';

test('«Як вчитися» відкривається з «Сьогодні» і з Налаштувань', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Як вчитися', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Як вчитися з найбільшим ефектом' }),
  ).toBeVisible();
  await expect(page.getByText('Чесне «Забув»')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);

  await page.goto('./#/settings');
  await page.getByRole('button', { name: /Як вчитися з найбільшим ефектом/ }).click();
  await expect(page).toHaveURL(/#\/guide$/);
});

test('нагадування без синхронізації просять її підключити', async ({ page }) => {
  await page.goto('./#/settings');
  await expect(page.getByRole('heading', { name: 'Нагадування' })).toBeVisible();
  await expect(page.getByText('спершу підключи синхронізацію')).toBeVisible();
});
