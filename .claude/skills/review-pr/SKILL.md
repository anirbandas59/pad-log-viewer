---
name: review-pr
description: Review one PAD Log Viewer PR, or every open PR labelled ready-for-review, against its milestone acceptance criteria and post a GitHub review. Use as `/review-pr [PR number]`; called by .github/workflows/claude-review.yml.
argument-hint: '[PR number]'
---

# Review PR(s): $ARGUMENTS

1. **Select PRs.** If a number was given, review that PR. Otherwise list `gh pr list --label ready-for-review --json number` and review each one in turn.
2. **Round limit.** For each PR, count prior reviews whose body contains `Verdict: REQUEST_CHANGES` (`gh pr view <PR> --json reviews`). If there are already 3, do not review again: run `gh pr edit <PR> --remove-label ready-for-review --add-label needs-human`, comment "3 review rounds reached; needs a human decision", and move on.
3. **Delegate.** Use the `reviewer` subagent for the PR, passing the PR number. It returns the full review text ending in `Verdict: APPROVE` or `Verdict: REQUEST_CHANGES`.
4. **Post.** Write the review body to a temp file and post it:
   - APPROVE: `gh pr review <PR> --approve --body-file <file>`
   - REQUEST_CHANGES: `gh pr review <PR> --request-changes --body-file <file>`
   - If GitHub refuses the approve/request-changes event (e.g. self-review), fall back to `gh pr review <PR> --comment --body-file <file>`.
5. **Relabel.** `gh pr edit <PR> --remove-label ready-for-review --add-label approved` or `--add-label changes-requested` to match the verdict (remove the opposite label if present).
6. Print one line per PR: number, verdict, number of Blocking findings.
