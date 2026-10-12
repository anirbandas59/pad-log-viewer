---
name: start-milestone
description: Build one PAD Log Viewer milestone end to end on a feature branch and open its PR into dev. Use as `/start-milestone <N>` (e.g. 1, 1b, 2).
argument-hint: <milestone number>
---

# Start milestone $ARGUMENTS

You are the cloud developer for milestone **M$ARGUMENTS**. Work autonomously; escalate only for the items listed under "Escalate" in `CLAUDE.md`.

1. **Sync.** `git fetch origin && git switch dev && git pull --ff-only`. Confirm `npm run check` is green on `dev` before changing anything; if not, stop and report.
2. **Branch.** Take the branch name for M$ARGUMENTS from the Milestones table in `docs/implementation-plan.md` (`feature/m<N>-<slug>`) and `git switch -c` it from `dev`. If it already exists on origin, check it out and continue instead.
3. **Plan.** Read the milestone's Scope and Key acceptance criteria, plus the relevant sections of `docs/architecture.md`. Write a short plan: files to touch, one test per acceptance criterion, and anything ambiguous (decide routine engineering questions yourself; escalate architecture, scope or safety changes).
4. **Tests first.** Write failing Vitest tests in `tests/unit/` for every acceptance criterion and every exported `core/` function. Run `npx vitest run <file>` and confirm they fail for the right reason. Commit: `test(m<N>): add failing tests for <scope>`.
5. **Build.** Implement until the tests pass. Keep `src/core/` free of React. Commit in small conventional commits (no author/co-author lines).
6. **Verify.** `npm run check` must be green. For UI milestones, capture screenshots at 375, 768 and 1366 px for the PR.
7. **Push.** `git push -u origin feature/m<N>-<slug>` (never `main`/`dev`, never `--force`).
8. **Open the PR** into `dev`: `gh pr create --base dev --title "feat(m<N>): <scope>" --body-file <file>` using `.github/pull_request_template.md`, with every acceptance criterion as a checklist item ticked and its evidence. List any proposed `.claude/`, `CLAUDE.md` or workflow changes under "Proposed config changes".
9. **Label and hand off.** `gh pr edit <PR> --add-label ready-for-review`, then turn on Auto-fix for the PR so review findings come back to this session.
10. **On review findings** (`changes-requested`): fix every **Blocking** finding (Suggestions at your discretion, say which you took), `npm run check`, push, then `gh pr edit <PR> --remove-label changes-requested --add-label ready-for-review`. If the PR is labelled `needs-human`, stop and report.

Do not start a different milestone. Report the PR URL when done.
