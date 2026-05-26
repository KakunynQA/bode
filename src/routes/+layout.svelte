<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import ConnectionIndicator from '$lib/components/ConnectionIndicator.svelte';
	import { initializeConnection } from '$lib/stores/connection';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		initializeConnection();
		const stored = localStorage.getItem('bode-theme');
		if (stored === 'light') {
			document.documentElement.classList.add('light');
		}
	});
</script>

<div class="flex h-screen w-screen overflow-hidden bg-[var(--color-bg)]">
	<Sidebar />
	<main class="flex-1 overflow-auto">
		{@render children()}
	</main>
	<ConnectionIndicator />
</div>
