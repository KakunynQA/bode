<script lang="ts">
	let selectedPeriod = $state('30d');

	const periods = [
		{ value: '7d', label: '7 Days' },
		{ value: '30d', label: '30 Days' },
		{ value: '90d', label: '90 Days' },
	];
</script>

<div class="flex h-full flex-col">
	<header class="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
		<h1 class="text-xl font-bold text-[var(--color-text)]">Stats</h1>
		<div class="flex items-center gap-2">
			<label for="period-select" class="text-sm text-[var(--color-text-secondary)]">Period</label>
			<select
				id="period-select"
				bind:value={selectedPeriod}
				class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
				aria-label="Period"
			>
				{#each periods as period (period.value)}
					<option value={period.value}>{period.label}</option>
				{/each}
			</select>
		</div>
	</header>

	<div class="flex-1 overflow-y-auto p-6">
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- Cost per Day -->
			<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6" data-testid="chart-cost-per-day">
				<h3 class="mb-4 text-sm font-semibold text-[var(--color-text)]">Cost per Day</h3>
				<div class="flex h-48 items-center justify-center text-sm text-[var(--color-text-muted)]">
					Chart will render here (uPlot)
				</div>
			</div>

			<!-- Cost per Model -->
			<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6" data-testid="chart-cost-per-model">
				<h3 class="mb-4 text-sm font-semibold text-[var(--color-text)]">Cost per Model</h3>
				<div class="flex h-48 items-center justify-center text-sm text-[var(--color-text-muted)]">
					Chart will render here (uPlot)
				</div>
			</div>

			<!-- Sessions per Type -->
			<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6" data-testid="chart-sessions-per-type">
				<h3 class="mb-4 text-sm font-semibold text-[var(--color-text)]">Sessions per Type</h3>
				<div class="flex h-48 items-center justify-center text-sm text-[var(--color-text-muted)]">
					Chart will render here (uPlot)
				</div>
			</div>

			<!-- Sessions per Status -->
			<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6" data-testid="chart-sessions-per-status">
				<h3 class="mb-4 text-sm font-semibold text-[var(--color-text)]">Sessions per Status</h3>
				<div class="flex h-48 items-center justify-center text-sm text-[var(--color-text-muted)]">
					Chart will render here (uPlot)
				</div>
			</div>
		</div>
	</div>
</div>
