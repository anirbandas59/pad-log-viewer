# PAD Log Viewer

A single self-contained HTML file that turns a Power Automate Desktop run-log CSV into an interactive review screen, entirely in the browser. No install, no server, and no data leaves the machine: the page makes no network requests at all, and its Content-Security-Policy blocks any that something might try.

Design: [docs/architecture.md](docs/architecture.md) · Delivery plan: [docs/implementation-plan.md](docs/implementation-plan.md)

## Reviewer guide

### Get it

1. Download `pad-log-viewer-vX.Y.Z.html` from the latest release (or from the team channel where the maintainer posts it).
2. Save it as `pad-log-viewer.html` in a folder you will keep, for example `Documents\PAD Log Viewer\`. Use that same name and folder for every version (see [Upgrading](#upgrading)).
3. Double-click it. It opens in your default browser (Edge or Chrome) straight from disk. Bookmark it if you like.

Nothing is installed and nothing needs a server, Node or admin rights.

### Review a run

1. In the Power Automate portal, open the desktop flow run and export its run log as CSV.
2. Drop the CSV on the page, or use **Browse files**. Several files at once are fine.
3. Open the run from the history list:
   - **Overview:** where the time went and what broke. **Jump to row** takes you to the first failure.
   - **Execution log:** every action in order. Search, filter by status, subflow or module, **Errors only**, **Hide noise**, choose columns, switch to **Compact rows**. Keys: ↑/↓ move, Enter opens the row, Esc closes it, `/` searches, `f` jumps to the next failure.
   - **Row details:** the action's inputs and outputs, values PAD cut short marked "truncated by PAD", the raw JSON, **Copy row as text** for tickets and chats, a **Bookmark** and a **Note**.
   - **Variables:** every variable with each value it was given, in order, each linked to its row.
   - **Errors:** each failure with the three actions before it and its full message.
4. **Export filtered CSV** saves the rows that pass your filters as a CSV in the same format, which you can share or drop back in (it opens as a run of its own).

### Your data

- Runs, bookmarks and notes are kept **in this browser only** (IndexedDB), for this file. They hold client data: delete runs you no longer need, or use **Clear all history**.
- Browsers and some managed machines clear stored data. Use **Export workspace** now and then to save everything to a `.padworkspace.json` file, and **Import workspace** to bring it back, on this or another machine.
- If storage is blocked entirely, the app says so and works for the session only.

### Upgrading

1. **Export workspace** first.
2. Save the new `pad-log-viewer-vX.Y.Z.html` over the old file: **same folder, same name `pad-log-viewer.html`**. The browser ties stored history to the file's location, so a copy saved elsewhere starts with an empty history (import your workspace there if that happens).
3. The version is shown at the bottom of the home screen. See [What's new](#whats-new).

### If something is blocked

- **The page is blank or the download is refused:** some estates block `.html` downloads from SharePoint or Teams. Ask the maintainer for the `.zip`.
- **"History is kept in this browser only and may be cleared":** your browser did not grant persistent storage. The app still works; export your workspace regularly.

## What's new

### Unreleased (v1 candidate)

- Home: drop several CSVs, history with search, status filter and rename, storage warning, workspace export and import.
- Run view: Overview, Execution log (virtualized for 10,000+ rows, filters, columns, keyboard), row details with notes and bookmarks, Variables, Errors, Export filtered CSV, compact rows.
- Ships as one HTML file with a Content-Security-Policy that blocks all network access.

## Contributor guide

Node 24 (`nvm use`), then:

| Command                                                  | What it does                                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                 | Install exact dependency versions                                                                          |
| `npm run dev`                                            | Dev server with hot reload                                                                                 |
| `npm test`                                               | Unit tests (Vitest)                                                                                        |
| `npm run test:e2e`                                       | Browser tests (Playwright, Chromium) on the built file, served by `vite preview` and opened from `file://` |
| `npm run check`                                          | Typecheck, lint, unit tests, build and the 1.5 MB size budget: run before every PR                         |
| `npm run sanitize -- <log.csv> --terms "Client,Machine"` | Turn a real export into a fixture with no client data (only its output goes in `tests/fixtures/`)          |

`npm run build` writes one file, `dist/pad-log-viewer.html`. The build inlines every script, style and icon, hashes the inline script and stylesheet into the page's Content-Security-Policy (`scripts/lib/csp.ts`), and fails if anything would load from outside the file. In cloud sessions without a downloaded browser, point Playwright at an installed Chromium with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

Work happens one milestone per branch and PR into `dev`; see [CLAUDE.md](CLAUDE.md) for the rules and review flow.

## Releasing

Follow the release checklist in [CLAUDE.md](CLAUDE.md): bump `version` in `package.json`, update [What's new](#whats-new), open `dev` → `main` as `chore(release): vX.Y.Z`, then tag `vX.Y.Z` on `main`. The release workflow builds `pad-log-viewer-vX.Y.Z.html` and attaches it to the GitHub release. Check the file on a locked-down machine and in Edge from `file://` before announcing it.
