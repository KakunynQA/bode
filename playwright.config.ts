import { defineConfig, devices } from '@playwright/test';

const isSmoke = process.env.E2E_MODE === 'smoke';

export default defineConfig({
	testDir: './tests/e2e',
	testMatch: isSmoke ? '**/*.smoke.spec.ts' : '**/*.spec.ts',
	testIgnore: isSmoke ? [] : '**/*.smoke.spec.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 2 : undefined,
	reporter: process.env.CI ? [['github'], ['html']] : 'html',
	timeout: 30_000,
	expect: { timeout: 5_000 },

	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
	},

	webServer: {
		command: isSmoke ? 'bun run dev' : 'bun run dev:e2e',
		url: 'http://localhost:5173',
		reuseExistingServer: !process.env.CI,
		timeout: 60_000,
	},

	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
