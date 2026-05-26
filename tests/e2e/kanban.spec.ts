import { test, expect } from '@playwright/test';

test.describe('Kanban Board', () => {
	test('renders existing sessions on load', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByRole('heading', { name: 'Board' })).toBeVisible();
		await expect(page.getByText('Add user auth flow')).toBeVisible();
		await expect(page.getByText('Fix SSE reconnection bug')).toBeVisible();
	});

	test('shows four columns', async ({ page }) => {
		await page.goto('/');

		for (const col of ['Backlog', 'In Progress', 'Review', 'Done']) {
			await expect(page.getByRole('region', { name: col })).toBeVisible();
		}
	});

	test('clicking a card opens session detail panel', async ({ page }) => {
		await page.goto('/');

		await page.getByText('Add user auth flow').click();

		const panel = page.getByRole('complementary', { name: /session detail/i });
		await expect(panel).toBeVisible();
		await expect(panel.getByRole('tab', { name: 'Chat' })).toBeVisible();
		await expect(panel.getByRole('tab', { name: 'Diff' })).toBeVisible();
		await expect(panel.getByRole('tab', { name: 'Cost' })).toBeVisible();
		await expect(panel.getByRole('tab', { name: 'Tools' })).toBeVisible();
	});
});
