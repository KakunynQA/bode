<script lang="ts">
	import { theme } from '$lib/stores/theme';
	import { totalCost } from '$lib/stores/sessions';
	import { formatCost } from '$lib/utils/format';
	import { page } from '$app/state';

	const navItems = [
		{ href: '/', label: 'Board', icon: 'kanban' },
		{ href: '/stats', label: 'Stats', icon: 'chart' },
	] as const;

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<aside class="flex w-16 flex-col items-center border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-4 lg:w-56 lg:items-start lg:px-4">
	<!-- Logo -->
	<a href="/" class="mb-8 flex items-center gap-2" aria-label="Bode Home">
		<span class="text-2xl">🐐</span>
		<span class="hidden text-lg font-bold text-[var(--color-text)] lg:block">Bode</span>
	</a>

	<!-- Navigation -->
	<nav class="flex flex-1 flex-col gap-1 w-full" aria-label="Main navigation">
		{#each navItems as item (item.href)}
			<a
				href={item.href}
				class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors {isActive(item.href)
					? 'bg-[var(--color-accent)] text-white'
					: 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]'}"
				aria-current={isActive(item.href) ? 'page' : undefined}
			>
				{#if item.icon === 'kanban'}
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
					</svg>
				{:else if item.icon === 'chart'}
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
					</svg>
				{/if}
				<span class="hidden lg:block">{item.label}</span>
			</a>
		{/each}
	</nav>

	<!-- Bottom section -->
	<div class="flex w-full flex-col gap-2">
		<div class="hidden rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2 lg:block">
			<p class="text-xs text-[var(--color-text-muted)]">Total Cost</p>
			<p class="text-sm font-medium text-[var(--color-text)]">{formatCost($totalCost)}</p>
		</div>

		<button
			onclick={() => theme.toggle()}
			class="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)] lg:justify-start"
			aria-label="Toggle theme"
		>
			{#if $theme === 'dark'}
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
				</svg>
				<span class="hidden lg:block text-sm">Light Mode</span>
			{:else}
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
				</svg>
				<span class="hidden lg:block text-sm">Dark Mode</span>
			{/if}
		</button>
	</div>
</aside>
