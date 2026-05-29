import type { ProjectConfig } from '~/config/schema.ts';

export type MultiRepoPlan = {
	repos: Array<{ name: string; workdir: string; role?: string; optional?: boolean }>;
};

export function buildMultiRepoPlan(project: ProjectConfig): MultiRepoPlan {
	return {
		repos: (project.repos ?? []).map((repo) => ({
			name: repo.name ?? repo.workdir,
			workdir: repo.workdir,
			...(repo.role ? { role: repo.role } : {}),
			...(repo.optional !== undefined ? { optional: repo.optional } : {}),
		})),
	};
}
