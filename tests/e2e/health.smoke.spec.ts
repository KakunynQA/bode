import { test, expect } from '@playwright/test';

test.describe('Smoke: real OpenCode', () => {
	test('connects to local OpenCode server', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByText(/connected/i)).toBeVisible({ timeout: 10_000 });
	});

	test('lists at least one provider', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: /new task/i }).click();

		const modelSelect = page.getByLabel('Model');
		const options = await modelSelect.locator('option').count();
		expect(options).toBeGreaterThan(0);
	});
});
