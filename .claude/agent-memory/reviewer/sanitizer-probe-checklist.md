---
name: sanitizer-probe-checklist
description: Edge cases to probe in scripts/lib/sanitize.ts whenever a PR touches the sanitizer or adds fixtures (gaps found in M1 retro review)
metadata:
  type: project
---

When reviewing anything that touches the fixture sanitizer (scripts/lib/sanitize.ts) or adds fixtures from real logs (M1b onward), run a quick probe script (build the CSV with Papa.unparse, not JSON.stringify, or backslashes get doubled) for these leak cases. The M1 retro review (PR #4, 2026-10-12) found all of these leaked with `residual: []`:

- forward-slash paths `C:/Users/<name>/...` and `file://host/share` URIs
- `DOMAIN\user` where the domain is lower/mixed case (`whoami` prints `corp\jdoe`); ACCOUNT regex was uppercase-only
- JSON object keys (only values are learned and rewritten)
- OneDrive org folder `OneDrive - <Org>` not learned as a term
- regression risk from the fix: `https://…` must not be read as a forward-slash drive path (`s:/`); URL pseudonyms must stay `https://hostN.example.test/pathN`

**Why:** M1b feeds real client logs through the sanitizer; the residual check only covers values it already learned, so unlearned patterns pass silently.
**How to apply:** re-probe these cases and check they are now covered by tests in tests/unit/scripts/sanitize.test.ts before approving.
