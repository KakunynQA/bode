<script lang="ts">
	import { listProviders, listAgents, createSession, sendPromptAsync } from '$lib/opencode/client';
	import type { Provider, Agent, TaskType, Priority } from '$lib/types';
	import { onMount } from 'svelte';

	let {
		onClose,
		onCreated,
	}: {
		onClose: () => void;
		onCreated: () => void;
	} = $props();

	let title = $state('');
	let description = $state('');
	let selectedModel = $state('');
	let selectedAgent = $state('');
	let taskType = $state<TaskType>('feature');
	let priority = $state<Priority>('medium');
	let externalRef = $state('');
	let isSubmitting = $state(false);
	let validationError = $state<string | null>(null);
	let providers = $state<Provider[]>([]);
	let agents = $state<Agent[]>([]);

	onMount(async () => {
		const [providerResult, agentResult] = await Promise.allSettled([
			listProviders(),
			listAgents(),
		]);

		if (providerResult.status === 'fulfilled' && providerResult.value.ok) {
			providers = providerResult.value.value.all;
		}
		if (agentResult.status === 'fulfilled' && agentResult.value.ok) {
			agents = agentResult.value.value;
		}
	});

	async function handleSubmit() {
		validationError = null;

		if (!title.trim()) {
			validationError = 'Title is required';
			return;
		}

		isSubmitting = true;

		const sessionResult = await createSession();
		if (!sessionResult.ok) {
			validationError = 'Failed to create session';
			isSubmitting = false;
			return;
		}

		if (description.trim()) {
			await sendPromptAsync(sessionResult.value.id, description);
		}

		isSubmitting = false;
		onCreated();
		onClose();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
	role="presentation"
	onclick={handleBackdropClick}
>
	<div
		class="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-2xl"
		role="dialog"
		aria-label="Create new task"
		aria-modal="true"
	>
		<h2 class="mb-6 text-lg font-semibold text-[var(--color-text)]">New Task</h2>

		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="flex flex-col gap-4">
			<!-- Title -->
			<div>
				<label for="task-title" class="mb-1 block text-sm text-[var(--color-text-secondary)]">Title</label>
				<input
					id="task-title"
					type="text"
					bind:value={title}
					placeholder="What needs to be done?"
					class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
				/>
				{#if validationError}
					<p class="mt-1 text-xs text-[var(--color-error)]">{validationError}</p>
				{/if}
			</div>

			<!-- Description -->
			<div>
				<label for="task-description" class="mb-1 block text-sm text-[var(--color-text-secondary)]">Description</label>
				<textarea
					id="task-description"
					bind:value={description}
					placeholder="Describe the task in detail..."
					rows="3"
					class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none resize-none"
				></textarea>
			</div>

			<!-- Model + Agent row -->
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="task-model" class="mb-1 block text-sm text-[var(--color-text-secondary)]">Model</label>
					<select
						id="task-model"
						bind:value={selectedModel}
						class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
					>
						<option value="">Default</option>
						{#each providers as provider (provider.id)}
							{#each provider.models as model (model.id)}
								<option value={model.id}>{provider.name} / {model.name}</option>
							{/each}
						{/each}
					</select>
				</div>
				<div>
					<label for="task-agent" class="mb-1 block text-sm text-[var(--color-text-secondary)]">Agent</label>
					<select
						id="task-agent"
						bind:value={selectedAgent}
						class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
					>
						<option value="">Default</option>
						{#each agents as agent (agent.id)}
							<option value={agent.id}>{agent.name}</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- Type + Priority row -->
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="task-type" class="mb-1 block text-sm text-[var(--color-text-secondary)]">Type</label>
					<select
						id="task-type"
						bind:value={taskType}
						class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
					>
						<option value="feature">Feature</option>
						<option value="fix">Fix</option>
						<option value="update">Update</option>
						<option value="refactor">Refactor</option>
					</select>
				</div>
				<div>
					<label for="task-priority" class="mb-1 block text-sm text-[var(--color-text-secondary)]">Priority</label>
					<select
						id="task-priority"
						bind:value={priority}
						class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
					>
						<option value="low">Low</option>
						<option value="medium">Medium</option>
						<option value="high">High</option>
					</select>
				</div>
			</div>

			<!-- External ref -->
			<div>
				<label for="task-ref" class="mb-1 block text-sm text-[var(--color-text-secondary)]">External Link (optional)</label>
				<input
					id="task-ref"
					type="url"
					bind:value={externalRef}
					placeholder="https://github.com/org/repo/issues/42"
					class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
				/>
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-3 pt-2">
				<button
					type="button"
					onclick={onClose}
					class="rounded-lg px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={isSubmitting}
					class="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
				>
					{isSubmitting ? 'Creating...' : 'Create Task'}
				</button>
			</div>
		</form>
	</div>
</div>
