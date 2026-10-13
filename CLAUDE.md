# PAD Log Viewer

A single self-contained HTML file (Vite + React 19 + TypeScript, built with `vite-plugin-singlefile`) that turns a Power Automate Desktop run-log CSV into an interactive review screen, entirely in the browser. Design source of truth: @docs/architecture.md. Delivery plan, milestones and review protocol: `docs/implementation-plan.md`.

Node 24 (`.nvmrc`). `npm ci`, `npm run dev`, `npm test`, `npm run check`.

## Hard rules

- No runtime network calls, CDN imports or telemetry; all assets inlined.
- `src/core/` never imports React or `src/features/`.
- Timestamps are BigInt ticks; rows sort by Log index.
- No CSV files outside `tests/fixtures/`; fixtures come only from the sanitizer.
- Every exported `core/` function has unit tests, written as failing tests from the milestone's acceptance criteria before the implementation.
- One milestone per branch and PR; conventional commit messages.
- Never push to `main` or `dev`; never force-push.
- Commit messages: `type(scope): subject` (feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert; subject ≤ 72 chars), blank line, optional body. **Never** add `Co-Authored-By`, `Author`, `Signed-off-by` or "Generated with" lines. A hook blocks violations.
- Commits are authored as `Anirban Das <anirbandas59@outlook.com>` (the SessionStart hook sets this in cloud sessions); never as Claude, never with `--author`.
- PR bodies, reviews and comments carry no attribution: no "Generated with/by Claude Code" footer, robot emoji or `claude.ai/code/session_…` link. A hook blocks violations.
- Log values render as text, never as HTML.

## Test-first rule

For each acceptance criterion of the milestone: write the failing Vitest test in `tests/unit/` (mirroring `src/core/`), run it and see it fail, then implement until it passes. Fixtures live in `tests/fixtures/` and are synthetic or sanitizer output.

## Definition of done (per milestone)

- `npm run check` green (typecheck + lint + test + build + size budget ≤ 1.5 MB).
- Every acceptance criterion ticked in the PR body with evidence (test name, output, or screenshot).
- `docs/architecture.md` updated if behaviour differs from it.

## Milestone workflow

1. Start from an up-to-date `dev`: `/start-milestone <N>`. Cloud sessions work on their assigned `claude/<task>-<id>` branch (the only branch they can push to); local sessions use `feature/m<N>-<slug>`. The PR title `feat(m<N>): …` identifies the milestone.
2. Plan from the Milestones table in `docs/implementation-plan.md`; write failing tests; implement; `npm run check`.
3. Open a PR into `dev` using `.github/pull_request_template.md`, label it `ready-for-review`, turn on Auto-fix.
4. The reviewer (GitHub Actions) posts a review and relabels `approved` or `changes-requested`. On `changes-requested`, fix every **Blocking** finding, push, relabel `ready-for-review`.
5. After 3 `REQUEST_CHANGES` rounds the PR is labelled `needs-human`; stop and wait.
6. The maintainer merges only when **every** `review-gate` check entry on the head is green: it requires the reviewer's latest review to APPROVE the exact head commit (there is no branch protection on this plan). A dismissed approval turns its entry red.

`main` is untouched until the v1 release merges `dev` into it. Until then `.github/workflows/claude-review.yml` must stay identical to its copy on `main`: `claude-code-action` skips the review when the two differ. The reviewer reads `.claude/` from the PR branch, so keep milestone branches up to date with `dev` (`git merge origin/dev`).

Escalate (stop and ask in the PR/session) for: a dependency outside the Architecture tech stack, a data-model change, anything adding a network call, or changes to `.claude/`, `CLAUDE.md` or CI workflows (cloud sessions are blocked from editing those; propose them in the PR body under "Proposed config changes").

## Release checklist (dev → main, local session)

1. `dev` CI green; all milestone PRs merged; `npm ci && npm run check && npm run test:e2e` green locally.
2. Real-log validation (deferred M1b): the maintainer sanitizes 2–3 real exports into `tests/fixtures/` (`npm run sanitize`); add tests that check, against them, every item listed under "Real-log validation" in `docs/implementation-plan.md`: (1) the fixtures contain no usernames, client paths or project ids (re-probe the sanitizer's known leak cases in `.claude/agent-memory/reviewer/sanitizer-probe-checklist.md`); (2) the timestamp forms accepted by `ticks` (architecture: Parsing rules, Timestamps); (3) the file-name pattern and its export-timestamp format (architecture: File name; open question); (4) M2 block-depth rules and the opening/closing action names (architecture: Processing pipeline step 5.3; open question); (5) Inputs/Outputs parse as `{ localizedName, value, variableName }` JSON; (6) parse + normalize < 1 s on a real 10k-row log, and the 2–5 MB per-run storage estimate. Fix mismatches in a `fix(m<N>)` PR first.
3. Bump `version` in `package.json`; update README reviewer guide and "What's new".
4. Open PR `dev` → `main` titled `chore(release): vX.Y.Z` with the changelog; the maintainer merges.
5. Maintainer tags `vX.Y.Z` on `main`; `release.yml` builds `pad-log-viewer-vX.Y.Z.html` and attaches it to the release.
6. Maintainer checks the HTML on a locked-down machine and in Windows Edge from `file://`.
7. After the v1 merge (`main` and `dev` equal again), fix `claude-review.yml` in one PR to both branches: move `concurrency` from workflow to job level (skipped runs currently cancel live reviews) and add `checks: read` (the reviewer cannot read CI status).
