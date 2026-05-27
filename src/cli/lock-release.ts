/**
 * Register handlers to release a task lock on every kind of process exit:
 *  - normal exit (returns)
 *  - SIGINT (ctrl-C)
 *  - SIGTERM (kill)
 *  - uncaught exception
 *
 * Idempotent — only releases once. Lockfile design also recovers stale
 * locks on next acquire (pid + host check), so this is best-effort cleanup,
 * not the only safety net.
 */
export function registerLockReleaseHandlers(release: () => Promise<void>): void {
	let released = false;

	const sync = (): void => {
		if (released) return;
		released = true;
		// Best-effort: schedule the async release but don't await — `exit` is sync.
		release().catch(() => {});
	};

	const onSignal = (signal: NodeJS.Signals): void => {
		release()
			.catch(() => {})
			.finally(() => {
				released = true;
				process.kill(process.pid, signal);
			});
	};

	process.once('exit', sync);
	process.once('SIGINT', () => onSignal('SIGINT'));
	process.once('SIGTERM', () => onSignal('SIGTERM'));
	process.once('uncaughtException', (err) => {
		release()
			.catch(() => {})
			.finally(() => {
				released = true;
				console.error(err);
				process.exit(1);
			});
	});
}
