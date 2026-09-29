import { expect, test } from '@playwright/test';

test('застосунок відкривається і бачить усі 2801 слово', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'NGSL Trainer' })).toBeVisible();
  await expect(page.getByText('2801 слово у 56 блоків')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
