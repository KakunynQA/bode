# Contributing to Bode

Thanks for considering a contribution. Bode is small and opinionated — please read this in full before opening a PR.

## Read first

- `SPEC.md` — what Bode does and doesn't do.
- `CONVENTIONS.md` — code style, structure, forbidden patterns.
- `AGENTS.md` — workflow rules (also apply to humans).
- `TESTING.md` — what to test and how.

## Setup

```bash
git clone https://github.com/KakunynQA/bode.git
cd bode
npm install
npm run dev -- --help
```

## Workflow

1. Open or pick an issue.
2. Branch from `main`: `feat/...`, `fix/...`, `refactor/...`, `chore/...`, `docs/...`, `test/...`.
3. Commit in small logical chunks with [Conventional Commits](https://www.conventionalcommits.org/).
4. Run the full validation chain before opening a PR (see below).
5. Open a PR describing **what / why / how to test**. Reference the issue.

## Validation

Every change must pass:

```bash
npm run check          # tsc --noEmit
npm run lint           # eslint src/ tests/
npm run format:check   # prettier
npm test               # node:test unit tests
npm run build          # esbuild → dist/index.js
```

CI runs all of the above on Node 18, 20, 22, 24.

## Tests

- Unit test for every new pure-logic module.
- Regression test for every bug fix (the test should fail before the fix and pass after).
- See `TESTING.md` for fixtures and integration test conventions.

## Adding a new AI CLI adapter

Follow `AGENTS.md → CLI adapter workflow`. The adapter must:

1. Extend `BaseCliAdapter`.
2. Be registered in `src/adapters/cli/registry.ts`.
3. Have its models listed in `src/adapters/cli/models.ts`.
4. Show up in the `bode setup` wizard (auto-discovered from the registry).

## Adding a new VCS provider

Follow `AGENTS.md → VCS adapter workflow`. Implement the `VcsAdapter` interface; register in `src/adapters/vcs/factory.ts`.

## Releases

1. Bump version in `package.json`.
2. Update `CHANGELOG.md`.
3. Commit `chore(release): vX.Y.Z`.
4. Tag `vX.Y.Z` and push. CI creates the GitHub release with tarball + dist.

## What we won't merge

- Dependencies added without a justification in the PR.
- Tests deleted "to make CI green."
- `// @ts-ignore` / `eslint-disable` without an inline reason.
- Direct Jira REST calls outside `src/adapters/jira/`.
- Direct `git` / `gh` / `glab` calls outside `src/adapters/vcs/`.
- Plaintext secrets committed to the repo.
