import { test, expect } from '@playwright/test';

test.describe('Stats Page', () => {
	test('renders charts', async ({ page }) => {
		await page.goto('/stats');

		await expect(page.getByRole('heading', { name: /stats/i })).toBeVisible();
		await expect(page.getByTestId('chart-cost-per-day')).toBeVisible();
		await expect(page.getByTestId('chart-cost-per-model')).toBeVisible();
		await expect(page.getByTestId('chart-sessions-per-type')).toBeVisible();
		await expect(page.getByTestId('chart-sessions-per-status')).toBeVisible();
	});

	test('filters by period', async ({ page }) => {
		await page.goto('/stats');

		await page.getByLabel(/period/i).selectOption('7d');

		await expect(page.getByTestId('chart-cost-per-day')).toBeVisible();
	});
});
