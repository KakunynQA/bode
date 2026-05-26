import { test, expect } from '@playwright/test';

test.describe('Create Task', () => {
	test('opens new task modal', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: /new task/i }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
	});

	test('creates a new task end-to-end', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: /new task/i }).click();

		await page.getByLabel('Title').fill('Refactor cost calculator');
		await page.getByLabel('Description').fill('Move cost logic into a pure module');
		await page.getByLabel('Model').selectOption('claude-opus-4-7');
		await page.getByLabel('Type').selectOption('refactor');
		await page.getByLabel('Priority').selectOption('medium');

		await page.getByRole('button', { name: /create/i }).click();

		await expect(page.getByRole('dialog')).toBeHidden();
		await expect(page.getByText('Refactor cost calculator')).toBeVisible();
	});

	test('validates required fields', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: /new task/i }).click();

		await page.getByRole('button', { name: /create/i }).click();

		await expect(page.getByText(/title is required/i)).toBeVisible();
	});
});
