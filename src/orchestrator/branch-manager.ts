// As of v0.18.0, bode no longer creates, checks out, deletes, pushes, or
// fetches git branches. The AI handles all of that during the implementation
// phase (issue #35).
//
// What's left here:
//   - `mergePR`: invokes the VCS adapter's gh/glab merge command from `bode done`.
//     This is a VCS operation (calls `gh` or `glab`), not a direct git call,
//     and keeping it here lets `bode done --auto-approve-pr-merge` work as a
//     simple state transition without spawning a full AI session.
//
// `branchNameForTask`, `startBranch`, `cleanupBranch`, `checkForConflicts`,
// `createPullRequest`, `switchToBase`, `getCurrentBranchName` were removed.

import type { Result } from '~/types/result.ts';
import type { VcsProvider } from '~/types/vcs.ts';
import { createVcsAdapter } from '~/adapters/vcs/factory.ts';

export async function mergePR(
	prNumber: number,
	provider: VcsProvider,
	signal?: AbortSignal
): Promise<Result<void>> {
	const vcs = createVcsAdapter(provider);
	return vcs.mergePR(prNumber, signal);
}
