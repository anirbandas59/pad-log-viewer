# Implementation plan

A local Claude Code session bootstraps the repo; cloud developer sessions build one milestone per pull request; a reviewer agent in GitHub Actions reviews each PR and posts findings that the cloud session fixes automatically. You approve merges and answer the decisions below.

## Decisions needed from you

Three decisions block the start; everything after them runs in Claude Code with your approval only at merges.

**D1 — Where the repo lives. Decided: option A, private repo anirbandas59/pad-log-viewer on github.com.** Cloud sessions clone from GitHub and push back through the Claude GitHub App. Self-hosted GitHub Enterprise Server works only on Team and Enterprise plans, and only after an admin installs the Claude GitHub App on that server.

| Option | Works with cloud sessions and auto-fix | Effort | Risk |
| --- | --- | --- | --- |
| **A. Private repo on github.com** (recommended) | Yes, as soon as the Claude GitHub App is installed | 10 minutes | IBM policy on hosting work code outside IBM; acceptable only because the repo holds code and sanitized fixtures, never client logs |
| B. IBM internal GitHub | Only if your Claude plan is Team/Enterprise and an IBM admin registers the app | Weeks, outside your control | Plan blocked until approval |

The Architecture tab has been updated to match.

**D2 — How the reviewer is triggered. Decided: option C, the reviewer runs in GitHub Actions.** Options considered:

| Option | How it fires | Your involvement |
| --- | --- | --- |
| **A. Scheduled check** (recommended) | A Claude Desktop scheduled task every 30 minutes reviews any PR labelled `ready-for-review` | None while the PC is on |
| B. On demand | You get a phone notification when a cloud session opens a PR, then run `/review-pr` locally | One command per PR |
| C. Cloud reviewer | GitHub Actions runs the reviewer on each PR | None, but review is no longer local |

**D3 — Who merges into `dev`.** Decided: you merge every milestone PR into dev and the release PR into main, after the reviewer approves and CI is green. That is 9 clicks for the whole project and keeps you as the final gate.

## How the agents work together

&#91;embedded content: milestone loop · cloud developer, Actions reviewer, your merge\]

The loop repeats per milestone: you dispatch the milestone, the cloud developer builds and opens a PR, the reviewer in GitHub Actions posts its review, findings return through Auto-fix, and after your merge you dispatch the next milestone.

## Branching and review protocol

Agents only ever push to `claude/*` (cloud session) or `feature/*` branches; `dev` and `main` change only through pull requests you merge.

| Branch | Purpose | Who writes to it |
| --- | --- | --- |
| `main` | Bootstrap commit, then tagged releases only | You, by merging the release PR from `dev` |
| `dev` | Integration branch; always builds and passes tests | You, by merging approved milestone PRs |
| `claude/<task>-<id>` | One milestone each; the branch the cloud session is assigned (cloud sessions can push only to it). The PR title `feat(m<N>): …` identifies the milestone | Cloud developer session |
| `feature/m<N>-<slug>` | One milestone each when built in a local session, e.g. `feature/m1-csv-core`; slugs in the Milestones table | Local developer session |

Both `main` and `dev` are protected on GitHub: PR required, CI must pass, no force-push. A hook also blocks agents from pushing to them, so the rule holds even if protection is misconfigured.

**PR lifecycle (GitHub labels):**

1. Developer session finishes the milestone, its Stop hook confirms checks pass, it opens a PR into `dev` labelled `ready-for-review` and turns on Auto-fix.
2. Reviewer picks up the PR, posts a GitHub review, and swaps the label to `changes-requested` or `approved`.
3. On `changes-requested`, Auto-fix in the cloud session reads the review comments, pushes fixes and relabels `ready-for-review`.
4. On `approved` with green CI, you download the PR's HTML artifact on whichever PC you are using, try it in Edge, then merge.

**Review verdict format.** Every finding is tagged **Blocking** (must fix: bug, failed acceptance criterion, architecture violation, data leaving the browser) or **Suggestion** (may fix). The review ends with a single verdict line: `APPROVE` or `REQUEST_CHANGES`, plus the acceptance-criteria checklist for the milestone with each item ticked or not.

**Round limit.** After 3 `REQUEST_CHANGES` rounds on the same PR, the reviewer labels it `needs-human` and stops; you decide.

## Your one-time setup

You do six steps, about 30 minutes in total, all in WSL Ubuntu or a browser. Claude Code does everything else, including creating the repo and protecting branches through `gh`.

**Before bootstrap**

1. In WSL, confirm the toolchain: `node -v` shows 24.x LTS, `git --version` shows 2.31 or later, `gh --version` and `claude --version` both run.
2. Run `gh auth login` and choose the GitHub account that will own the repo (per D1). Grant the `repo` and `workflow` scopes.
3. Run `claude auth login` with the claude.ai account that has Claude Code cloud sessions on its plan.
4. Create an empty folder `~/workspace/projects/pad-log-viewer`, open Claude Code there, and paste the bootstrap prompt from the next section.

**After bootstrap (Claude Code tells you when)**

5. In Claude Code in the repo folder, run `/install-github-app` and pick `anirbandas59/pad-log-viewer`. It installs the Claude GitHub App (needed for cloud cloning, pushing and Auto-fix) and stores the token the review workflow uses as a repo secret; choose the Claude subscription token so reviews draw on your plan, not separate API billing. If it offers to open a workflow PR, decline: bootstrap already committed `claude-review.yml`.
6. At [claude.ai/code](https://claude.ai/code), connect GitHub if prompted, and create a cloud environment named `pad-log-viewer` with **Trusted** network access. Leave the setup script empty; the repo's SessionStart hook installs dependencies.

Also turn on push notifications in the Claude mobile app, so you hear when a PR is ready to merge or a decision is waiting.

## Repository bootstrap (M0, local Claude Code)

One local session turns the empty folder into a building, testable, protected repo with the agent configuration in place, then commits it to `main` and branches `dev`.

1. **Docs in repo.** You export both tabs of this doc as Markdown into `docs/architecture.md` and `docs/implementation-plan.md` before bootstrap; Claude Code only checks they exist. Every agent reads these; the doc stays the human-facing copy.
2. **Git basics.** `git init -b main`, `.gitignore` (node\_modules, dist, test output, `*.csv` except `tests/fixtures/`), `.gitattributes` with `eol=lf`, `.nvmrc` pinned to Node 24, matching engines in package.json.
3. **Scaffold.** Vite React TypeScript template in place, then the libraries from the Architecture tech stack, exact versions pinned.
4. **Scripts in `package.json`.** `dev`, `build`, `preview`, `typecheck`, `lint`, `format`, `test` (Vitest), `test:e2e` (Playwright, wired in M8), `check:fast` (typecheck + lint on changed files), `check` (typecheck + lint + test + build + size budget).
5. **Skeleton.** The folder tree from the Architecture tab with empty modules and one passing smoke test, so `npm run check` is green from day one.
6. **Claude Code configuration.** `CLAUDE.md`, `.claude/settings.json`, hooks, subagents and skills as described in the next two sections.
7. **CI.** `.github/workflows/ci.yml` running `npm ci` and `npm run check` on every push and PR. On PRs it then uploads the built single-file HTML as an Actions artifact named pad-log-viewer-pr-\<number>, kept 30 days, so you can download and open it on any PC without Node.
8. **Publish.** Commit `chore: bootstrap project` to `main`; `gh repo create` (private, anirbandas59/pad-log-viewer) and push; create and push `dev`; create the four PR labels; protect `main` and `dev` through `gh api`.
9. **Hand-off.** Report the repo URL and tell you to do setup steps 5–7.

**Bootstrap prompt to paste (step 4 of your setup):**

```text
Bootstrap the PAD Log Viewer repository in this folder.
Source of truth: docs/architecture.md and docs/implementation-plan.md (already in place).
Follow the implementation plan, section "Repository bootstrap (M0)", steps 1–9, exactly.
Step 1 is only a check that both files exist and are readable.
Decisions D1–D3 are made; follow them as written. Use Node 24.
Use plan mode first and show me the plan; after I approve, execute without further questions
unless a step fails twice. Do not start any milestone work. Stop after step 9 and report.
```

## Claude Code configuration

All agent behaviour lives in the repo under `.claude/` and `CLAUDE.md`, so the cloud developer and the local reviewer read the same rules. Cloud sessions do not read your personal `~/.claude/` settings or hooks.

| File | Used by | Contents |
| --- | --- | --- |
| `CLAUDE.md` | Both | Short project brief, hard rules, test-first rule, definition of done, milestone workflow, release checklist; imports `docs/architecture.md` |
| `.claude/settings.json` | Both | Permissions and hooks (next section) |
| `.claude/skills/start-milestone/` | Cloud developer | `/start-milestone <N>`: branch from `dev`, plan, write failing tests from the acceptance criteria, build, test, open PR, label, turn on Auto-fix |
| `.claude/skills/review-pr/` | GitHub Actions reviewer | `/review-pr [PR]`: review one PR or every `ready-for-review` PR; called by the review workflow |
| `.claude/agents/reviewer.md` | GitHub Actions reviewer | Read-only reviewer subagent (Opus); posts the GitHub review; keeps persistent memory of recurring issues |
| `.github/pull_request_template.md` | Cloud developer | Milestone, acceptance-criteria checklist, test evidence, screenshots |

This is the complete set: one subagent, two skills, and the workflow .github/workflows/claude-review.yml, which runs /review-pr when a PR gets the ready-for-review label or new commits while it has it. A separate test-writer agent and a `/release` skill were considered and dropped; tests-first lives in `CLAUDE.md`, and a one-off v1 release doesn't justify a skill.

**Hard rules in `CLAUDE.md`:**

- No runtime network calls, CDN imports or telemetry; all assets inlined.
- `src/core/` never imports React or `src/features/`.
- Timestamps are BigInt ticks; rows sort by Log index.
- No CSV files outside `tests/fixtures/`; fixtures come only from the sanitizer.
- Every exported `core/` function has unit tests, written as failing tests from the milestone's acceptance criteria before the implementation.
- One milestone per branch and PR; conventional commit messages.
- Never push to `main` or `dev`; never force-push.

**Definition of done for a milestone:** `npm run check` green, every acceptance criterion ticked in the PR body with evidence, `docs/architecture.md` updated if behaviour differs from it.

**Permissions.** Allow `npm run *`, `npx vitest`, `npx playwright`, `git` read and commit commands, `git push` to `feature/*` and `claude/*`, and `gh pr` / `gh label`. Deny force-push, push to `main` or `dev`, reading `.env*`, and reading `*.csv` outside `tests/fixtures/`.

**Hand-off to the cloud.** A milestone starts with `claude --cloud "/start-milestone <N>"` run from the repo on an up-to-date `dev`. You run it after each merge into `dev`, one command per milestone.

## Hooks

Hooks enforce the rules mechanically; they react to events inside a session but cannot start one, so task start is `claude --cloud` (above) and hooks take over from the session's first event. All hook scripts are Node `.mjs` files in `.claude/hooks/`, so they run identically in the Linux cloud VM and in WSL with no `jq` dependency. Scripts branch on `CLAUDE_CODE_REMOTE`, which is `true` only in cloud sessions.

| Event (matcher) | Runs in | What it does | Effect |
| --- | --- | --- | --- |
| `SessionStart` (`startup`, `resume`) | Both | Cloud: set the maintainer git identity, warn if the Node major version is not 24, then `npm ci` if `node_modules` is missing. Both: add context for Claude with branch, active milestone (from branch name) and any open review findings on its PR | Context only |
| `PreToolUse` (`Bash(git push *)`) | Both | Deny pushes to `main` or `dev` and any `--force` | Blocks |
| `PreToolUse` (`Bash(git commit *)`) | Both | Deny a non-conventional or attributed message, an author other than the maintainer, or a staged `.csv` outside `tests/fixtures/`; run `npm run check:fast` and deny on failure with the errors | Blocks |
| `PreToolUse` (`Bash(gh pr …)`, `gh api …/pulls`) | Both | Deny PR bodies, reviews and comments with attribution (Generated-with footer, session link, co-author lines) | Blocks |
| `PreToolUse` (`Edit\|Write`) | Cloud | Deny edits to `.claude/**`, `CLAUDE.md` and `.github/workflows/**`, so the developer cannot weaken its own gates | Blocks |
| `PostToolUse` (`Edit\|Write`) | Both | Prettier and ESLint `--fix` on the edited file; remaining lint errors returned to Claude as context | Feedback |
| `Stop` | Cloud | If source changed since the last green run: `npm run check`; on failure exit 2 with a short summary so Claude keeps working. After 3 consecutive failures it lets Claude stop and report instead of looping | Prevents stopping |
| `SubagentStop` (`reviewer`) | GitHub Actions | Reject a review missing the verdict line or the acceptance-criteria checklist | Prevents stopping |
| `Notification` | Local | Reuse your existing WSL-to-Windows notification chain | Side effect |

The `PreToolUse` gates use `onFailure: "block"`, so a crashing or missing hook script blocks the action instead of silently allowing it. GitHub branch protection and CI duplicate the push and check gates, so no single layer is trusted alone.

## Milestones

Nine milestones, each one PR into `dev`, built bottom-up so every PR is testable on its own: logic first (M1–M3), UI next (M4–M7), shipping last (M8).

| # | Branch (local name; cloud uses `claude/*`) | Scope | Key acceptance criteria |
| --- | --- | --- | --- |
| M0 | `main` (local) | Bootstrap as above | `npm run check` green; repo, labels and protection in place |
| M1 | `feature/m1-csv-core` | `fileName`, `parseCsv`, `schema`, `ticks`, `payload`, `normalize`; sanitizer script; synthetic fixtures incl. 10k rows | File-name parse handles underscores in flow names; sub-ms durations exact; truncated values flagged; malformed JSON keeps raw string; 10k rows parse + normalize < 1 s |
| M1b | local, by you — **partly done**: one real export (successful run, nested blocks) is in `tests/fixtures/real/` (2026-10-13); a failed-run export is deferred to v1 validation | Run the sanitizer on 2–3 real logs (one failed run, one with nested If/Loop) and commit to `tests/fixtures/` | Fixtures contain no usernames, client paths or project ids |
| M2 | `feature/m2-derive` | Effect summary, block depth (configurable action list), variable index, run summary, search text | Depth rules verified on a synthetic nested fixture (If/Loop/For each inside each other, with End rows); real-log check deferred to v1 validation; top-10 slowest correct; variable history ordered by Log index |
| M3 | `feature/m3-storage` | IndexedDB schema, history, workspace export/import, persistence check | Tested with an in-memory IndexedDB; import merges by run GUID; bundle carries schema version |
| M4 | `feature/m4-shell-home` | Theme tokens, app shell, drop zone, error cards, history list, storage banner, duplicate prompt (Replace only; keep-both deferred past v1) | Multi-file drop; dark/light; works at 375, 768 and 1366 px |
| M5 | `feature/m5-run-overview` | Run header, tab scaffold, Overview tab | First-failure card jumps to its row; subflow time bars sum to run duration |
| M6 | `feature/m6-log-drawer` | Virtualized log table, filter bar, column picker, keyboard shortcuts, row drawer, JSON tree, copy actions | 10k rows scroll without blank rows; filter update < 100 ms; drawer shows truncation badge |
| M7 | `feature/m7-vars-errors` | Variables tab, Errors tab, bookmarks and notes, export filtered CSV, density toggle | Notes survive reload; exported CSV re-imports cleanly |
| M8 | `feature/m8-ship` | Single-file build, CSP, Playwright e2e on `file://`, zero-network assertion, size budget, release workflow, README | Built HTML opens from disk in Chromium and works end to end; zero network requests; ≤ 1.5 MB |
| Release | `dev` → `main` | A local session follows the release checklist in `CLAUDE.md` and opens the PR; you merge; tag `v1.0.0` builds the HTML | You open the HTML on a locked-down machine and on Windows Edge; real-log validation (deferred M1b) passes |

**Real-log validation (deferred M1b).** Until real exports are available, milestones verify against synthetic fixtures, and block opening/closing action names stay a configurable list. Before the v1 release you sanitize 2–3 real exports (one failed run, one with nested If/Loop) into `tests/fixtures/`, and every item `docs/architecture.md` leaves "to be confirmed against real logs" is checked against them: (1) the fixtures contain no usernames, client paths or project ids (re-probe the sanitizer's known leak cases in `.claude/agent-memory/reviewer/sanitizer-probe-checklist.md`); (2) the timestamp forms accepted by `ticks` (architecture: Parsing rules, Timestamps); (3) the file-name pattern and its export-timestamp format (architecture: File name; open question); (4) M2 block-depth rules and the opening/closing action names (architecture: Processing pipeline step 5.3; open question); (5) Inputs/Outputs parse as `{ localizedName, value, variableName }` JSON; (6) parse + normalize < 1 s on a real 10k-row log, and the 2–5 MB per-run storage estimate. Mismatches are fixed in a `fix(m<N>)` PR before the release PR. Done so far (2026-10-13), from the first real export in `tests/fixtures/real/`, pinned by `tests/unit/fixtures/realExport.test.ts`: (1) no client data after sanitizing with `--terms` and `--flow`, (2) ISO 7-digit timestamps, (3) the file-name format, (5) payload shape, (6) parse + normalize time on 1,235 rows, and the block-action counts for (4). M2 (2026-10-13) checks its depth rules against hand-worked spans of the same export in `tests/unit/fixtures/realDepth.test.ts`. Still needed: a failed-run export, and depth checked on more exports.

**Real-log validation result for v1 (2026-10-13)**, against the one real export in `tests/fixtures/real/` (1,235 rows, successful run, nested blocks):

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | No client data in fixtures | Pass (structural); one accepted exception | `tests/unit/fixtures/leakGuard.test.ts` fails CI on any e-mail, URL, GUID, user folder, 8+ digit run or encoded blob that is not a pseudonym. Free-text names are covered by `--terms`; the client name written in Chinese in two HTML templates was accepted by the maintainer (#14) |
| 2 | Timestamp forms | Pass | ISO 8601, 7 fractional digits, `Z` (`realExport.test.ts`); US short form also appears inside payload values |
| 3 | File-name format and export timestamp | Pass | `<flow>-<guid>-<yyyyMMddTHHmmssZ>.csv` (`realExport.test.ts`, `fileName.test.ts`) |
| 4 | Block depth and action names | Pass | depth from Action index per subflow (`realDepth.test.ts`, 6 tests on the real export) |
| 5 | Payload shape | Pass | 0 malformed, 159 truncated, `{ localizedName, value, variableName }` (`realExport.test.ts`) |
| 6 | Parse + normalize + derive under 1 s; storage 2–5 MB per 10k rows | Pass | single cold run in a fresh process: 33–46 ms for the real export, 229–264 ms for 10,000 synthetic rows; raw CSV 483 KB per 1,235 rows ≈ 3.9 MB per 10,000 |

Still open before the v1 release PR: a **failed-run** real export — the maintainer is providing one (2026-10-13); it gets the same sanitize, review, leak-guard and facts tests as the first. A **real 10,000-row** log is **waived for v1 by the maintainer (2026-10-13)**: the budget is checked on 10,000 synthetic rows (229–264 ms cold).

Milestones run one at a time: each starts from the `dev` that contains the previous merge, and parallel cloud sessions would share your plan's usage limits anyway.

## Escalation and risks

Agents decide routine engineering matters themselves and stop for anything that changes the architecture, scope or safety rules.

**Escalated to you (phone notification + PR label or session question):**

- Decisions D1–D3 above, once.
- A PR labelled `needs-human` after 3 review rounds.
- Any deviation from the Architecture tab: a dependency outside the tech stack, a data-model change, anything that adds a network call.
- Changes to `.claude/`, `CLAUDE.md` or CI workflows; the cloud developer is blocked from making them, so it proposes them in the PR body.
- M1b: providing real logs for sanitized fixtures (deferred to v1 validation).
- `dev` CI turning red after a merge, or a usage limit stopping a session.

**Not escalated:** lint and formatting fixes, extra tests, refactors inside a milestone, Suggestion-level review findings.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Cloud network blocks Playwright's browser download | E2E tests can't run in cloud sessions | Cloud runs unit tests only; e2e runs in the CI `e2e` job (from 2026-10-13, ahead of M8) and locally |
| Stop hook keeps failing | Session loops and burns usage | 3-failure cap, then the session stops and reports |
| Auto-fix misreads a review comment | Wrong fix, extra rounds | Reviewer cites `file:line` and the expected behaviour; 3-round limit |
| Developer and reviewer share blind spots | Bugs pass review | Reviewer works from the acceptance-criteria checklist, runs at higher effort, and you check UI screenshots in the PR |
| Auto-fix may not react to a review posted by the Actions bot | Fix rounds don't start | Verify on the M1 PR; fallback is pasting the review link into the cloud session |
| CI tests Linux Chromium, not Windows Edge from `file://` | IndexedDB or file-origin issues reach users | Manual check on Edge and a locked-down machine before every release |
| Company policy on hosting code outside IBM or using cloud agents | Project has to move later | Settle D1 before bootstrap |
