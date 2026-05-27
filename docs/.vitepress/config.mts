import { defineConfig } from 'vitepress';

export default defineConfig({
	title: 'Bode',
	description: 'AI coding orchestrator for Jira, Linear, GitHub Issues, and more',
	lastUpdated: true,
	cleanUrls: true,

	themeConfig: {
		nav: [
			{ text: 'Guide', link: '/guide/getting-started' },
			{ text: 'Reference', link: '/reference/cli' },
			{ text: 'Trackers', link: '/trackers/overview' },
			{
				text: 'GitHub',
				link: 'https://github.com/KakunynQA/bode',
			},
		],

		sidebar: {
			'/guide/': [
				{
					text: 'Getting Started',
					items: [
						{ text: 'Install', link: '/guide/getting-started' },
						{ text: 'First run', link: '/guide/first-run' },
						{ text: 'Configuration', link: '/guide/configuration' },
						{ text: 'Phases', link: '/guide/phases' },
					],
				},
				{
					text: 'Workflows',
					items: [
						{ text: 'With Jira', link: '/guide/with-jira' },
						{ text: 'With GitHub Issues', link: '/guide/with-github-issues' },
						{ text: 'With Linear', link: '/guide/with-linear' },
						{ text: 'Local-only (no tracker)', link: '/guide/local-only' },
					],
				},
			],
			'/reference/': [
				{
					text: 'Reference',
					items: [
						{ text: 'CLI commands', link: '/reference/cli' },
						{ text: 'Config schema', link: '/reference/config' },
						{ text: 'Skill prompts', link: '/reference/skills' },
						{ text: 'Run artifacts', link: '/reference/artifacts' },
					],
				},
			],
			'/trackers/': [
				{
					text: 'Trackers',
					items: [
						{ text: 'Overview', link: '/trackers/overview' },
						{ text: 'Jira', link: '/trackers/jira' },
						{ text: 'GitHub Issues', link: '/trackers/github-issues' },
						{ text: 'Linear', link: '/trackers/linear' },
						{ text: 'Notion', link: '/trackers/notion' },
						{ text: 'Trello', link: '/trackers/trello' },
						{ text: 'Local / plain-markdown', link: '/trackers/local' },
					],
				},
			],
		},

		socialLinks: [{ icon: 'github', link: 'https://github.com/KakunynQA/bode' }],

		footer: {
			message: 'Released under the MIT License.',
			copyright: 'Copyright © 2026-present Kakunyn',
		},
	},
});
