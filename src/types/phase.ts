export type PhaseName = 'planning' | 'implementation' | 'review';

export type PhaseStatus =
	| 'pending'
	| 'planning'
	| 'planned'
	| 'implementing'
	| 'reviewing'
	| 'reviewed'
	| 'awaiting-merge'
	| 'done'
	| 'aborted'
	| 'failed';

export type PhaseTransition =
	| { from: 'pending'; to: 'planning' }
	| { from: 'planning'; to: 'planned' }
	| { from: 'planned'; to: 'implementing' }
	| { from: 'implementing'; to: 'reviewing' }
	| { from: 'reviewing'; to: 'reviewed' }
	| { from: 'reviewed'; to: 'awaiting-merge' }
	| { from: 'awaiting-merge'; to: 'done' }
	| { from: PhaseStatus; to: 'aborted' }
	| { from: PhaseStatus; to: 'failed' };

export const PHASE_ORDER: PhaseStatus[] = [
	'pending',
	'planning',
	'planned',
	'implementing',
	'reviewing',
	'reviewed',
	'awaiting-merge',
	'done',
];

export function getNextPhase(current: PhaseStatus): PhaseStatus | null {
	const idx = PHASE_ORDER.indexOf(current);
	if (idx === -1 || idx >= PHASE_ORDER.length - 1) return null;
	return PHASE_ORDER[idx + 1] ?? null;
}

export function getPhaseNameForStatus(status: PhaseStatus): PhaseName | null {
	switch (status) {
		case 'planning':
			return 'planning';
		case 'implementing':
			return 'implementation';
		case 'reviewing':
			return 'review';
		default:
			return null;
	}
}

export function getPhaseStatusLabel(status: PhaseStatus): string {
	const labels: Record<PhaseStatus, string> = {
		pending: 'Pending',
		planning: 'Planning',
		planned: 'Planned',
		implementing: 'Implementing',
		reviewing: 'Reviewing',
		reviewed: 'Reviewed',
		'awaiting-merge': 'Awaiting Merge',
		done: 'Done',
		aborted: 'Aborted',
		failed: 'Failed',
	};
	return labels[status];
}
