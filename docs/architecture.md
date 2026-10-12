# PAD Log Viewer — Architecture

Oct 12, 2026 · @Anirban Das

PAD Log Viewer is a single self-contained HTML file that turns a Power Automate Desktop run-log CSV into an interactive review screen, entirely inside the browser. Nothing is installed on the reviewer's machine and no log data leaves it.

## Purpose and scope

PAD developers review the action logs of each desktop flow run. The Power Automate cloud run-details page makes that slow, so developers export the run's CSV and open it here instead.

**Users:** PAD developers on the team, each keeping their own run history. No clients, no sharing between users.

**Constraints that shape every decision:**

- Runs on locked-down corporate laptops and VDI: no admin rights, no software installs, no group-policy changes.
- Data stays local: no server, no network calls, no telemetry.
- Every action is a UI action for the reviewer; no terminal or CLI.
- Log size up to roughly 10,000 rows per CSV.

| v1 in scope | Deferred (v2+) |
| --- | --- |
| Home screen with run history and multi-file drop | Two-run diff |
| Run view: Overview, Execution log, Variables, Errors tabs | Timeline / Gantt view |
| Row detail drawer with parsed Inputs and Outputs | Folder sync via File System Access API |
| Bookmarks, notes and tags on runs and rows | Direct pull from Dataverse flow logs |
| Export filtered view to CSV; export/import workspace | Team-shared history |

## Key decisions

The app ships as one static HTML file with all JavaScript and CSS inlined; Node is used only to build it. The browser is the only runtime the target machine needs, and a browser is always present.

| Option | Needs on the reviewer's machine | Blocker risk on a locked-down PC | Decision |
| --- | --- | --- | --- |
| Static single-file HTML (built with Vite + React) | Edge or Chrome | Lowest | **Chosen** |
| Node / Next.js local server | Node runtime, npm registry access, a local port | High: AppLocker/WDAC on node.exe, proxy blocks npm, EDR flags listeners | Rejected |
| Python (Streamlit / Flask) | Python and pip packages | High: Python often absent or Store-blocked | Rejected |
| WinForms / WPF exe | .NET runtime, unsigned exe | Medium–high: SmartScreen and AppLocker | Rejected |
| Electron / Tauri portable exe | Unsigned exe, WebView2 for Tauri | Medium; code signing needed | Rejected for v1 |

**D1 — No server.** "Upload" means the browser reads the dropped file through the File API into page memory. Parsing and analysis run in the page's JavaScript.

**D2 — No Next.js.** SSR, routing and API routes add a runtime server with no benefit here. Vite produces the static bundle directly.

**D3 — Main-thread parsing, no Web Worker.** Under 10,000 rows parses in well under a second. Avoiding workers also avoids `file://` worker restrictions.

**D4 — Row virtualization stays.** 10,000 rows × 7 visible columns of styled cells is too many DOM nodes for smooth scroll and filter.

**D5 — Two artifacts from one repo.** Contributors clone the repo and run the dev server. Reviewers only ever receive `pad-log-viewer-vX.Y.Z.html`, built by CI.

**D6 — Optional loopback fallback.** If an estate blocks a capability from `file://`, a launcher can serve the same file on `127.0.0.1` only. It is not part of v1.

## Architecture

&#91;embedded content: components and data flow · v1\]

A dropped CSV runs through the core pipeline into app state and the UI. IndexedDB keeps the raw CSV so runs re-derive on reopen; the workspace file is the only way data leaves the browser, and only on the user's click.

## Tech stack

Every runtime library is bundled into the output HTML; nothing loads from a CDN at runtime, because corporate proxies may block it.

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript (strict) | Typed row model catches CSV-shape bugs at build time |
| UI framework | React 19 | Component model for tabs, drawer, tables |
| Build | Vite + `vite-plugin-singlefile` | Inlines all JS/CSS into one HTML file |
| CSV parsing | Papa Parse | RFC 4180 quoting, BOM handling, header mode |
| Table | TanStack Table | Sorting, filtering, column visibility, headless |
| Virtualization | TanStack Virtual | Renders only visible rows |
| State | Zustand | Small store, no provider boilerplate |
| Styling | Tailwind CSS with CSS-variable theme tokens | Light/dark themes, responsive utilities |
| Charts | Recharts (or uPlot if bundle size matters) | Overview bars and breakdowns |
| Icons | lucide-react (tree-shaken) | Module and status icons |
| Storage | IndexedDB via `idb` | Run history, notes, bookmarks |
| JSON viewer | Small in-house collapsible tree | Avoids a heavy dependency |
| Unit tests | Vitest | Parser and derivation logic |
| E2E tests | Playwright, run against the built HTML via `file://` | Proves the shipped artifact works |
| Lint/format | ESLint + Prettier | Consistency across contributors |

Versions are pinned in `package-lock.json`; a bundle-size budget is enforced in CI (see Build and release).

## Project structure

The repo separates pure logic (`core/`) from React UI (`features/`, `components/`), so parsing and derivation are testable without a browser.

```
pad-log-viewer/
├─ .github/workflows/
│  ├─ ci.yml               # lint, unit, e2e, bundle-size check on every PR
│  └─ release.yml          # builds the single HTML and attaches it to a release
├─ public/                 # favicon only (inlined at build)
├─ scripts/
│  └─ sanitize-log.ts      # turns a real log into a safe test fixture
├─ src/
│  ├─ main.tsx             # entry; mounts <App/>
│  ├─ app/
│  │  ├─ App.tsx           # screen switch: Home | Run view
│  │  ├─ store.ts          # Zustand store: open runs, active run, UI state
│  │  └─ theme.ts          # theme tokens, light/dark toggle
│  ├─ core/                # pure TypeScript, no React
│  │  ├─ csv/
│  │  │  ├─ parseCsv.ts         # Papa Parse wrapper, header validation
│  │  │  ├─ schema.ts           # expected columns, aliases
│  │  │  └─ fileName.ts         # <flow>_<guid>_<timestamp>.csv parser
│  │  ├─ model/
│  │  │  ├─ types.ts            # LogRow, RunMeta, RunRecord, Annotation
│  │  │  └─ normalize.ts        # raw row → LogRow
│  │  ├─ derive/
│  │  │  ├─ ticks.ts            # 7-digit timestamp → BigInt ticks, durations
│  │  │  ├─ payload.ts          # Inputs/Outputs JSON parse, truncation flag
│  │  │  ├─ effect.ts           # one-line effect summary per row
│  │  │  ├─ blocks.ts           # If/Loop nesting depth
│  │  │  ├─ variables.ts        # variable assignment index
│  │  │  └─ summary.ts          # run-level metrics, slowest actions
│  │  └─ storage/
│  │     ├─ db.ts               # IndexedDB schema and migrations
│  │     ├─ history.ts          # save, list, delete runs
│  │     ├─ workspace.ts        # export/import workspace bundle
│  │     └─ persistence.ts      # storage-persist check and warning
│  ├─ features/
│  │  ├─ home/            # DropZone, HistoryList, RunCard, StorageBanner
│  │  ├─ run/             # RunHeader, RunTabs
│  │  ├─ overview/        # SubflowTimeBar, SlowestActions, StatusBreakdown, FirstFailureCard
│  │  ├─ log/             # LogTable, FilterBar, ColumnPicker, EffectCell
│  │  ├─ variables/       # VariableList, AssignmentHistory
│  │  ├─ errors/          # ErrorList with context rows
│  │  └─ detail/          # RowDrawer, ParamTable, JsonTree, NoteEditor
│  ├─ components/         # Button, Chip, Badge, Tabs, Drawer, EmptyState
│  └─ styles/index.css    # Tailwind layers and CSS variables
├─ tests/
│  ├─ fixtures/           # sanitized CSVs only
│  ├─ unit/               # Vitest, mirrors src/core
│  └─ e2e/                # Playwright against dist/*.html
├─ index.html
├─ vite.config.ts
├─ tailwind.config.ts
├─ tsconfig.json
├─ package.json
└─ README.md              # reviewer guide + contributor guide
```

The dependency rule: `features/` may import `core/`; `core/` never imports React or `features/`.

## Input contract

The app accepts the PAD run-log CSV as exported from the Power Automate portal, identifies columns by header name, and identifies the run from the file name.

### Columns

| Column | Type after parsing | Use |
| --- | --- | --- |
| Start time | BigInt ticks (100 ns) + ISO string | Ordering, relative time, duration |
| End time | BigInt ticks + ISO string | Duration |
| Subflow | string | Subflow chip, filter, time breakdown |
| Log index | integer | Global execution order; primary sort key |
| Action index | integer | Line number inside the subflow; repeats in loops |
| Module name | string | Internal module id (hidden by default) |
| Action name | string | Internal action id (hidden by default) |
| Module display name | string | Module icon and filter |
| Action display name | string | Primary label in the log table |
| Log level | string, often empty | Severity colour |
| Log message | string, often empty | Message column |
| Status | Succeeded / Failed / other | Status colour, error detection |
| Inputs | JSON object (parsed) | Detail drawer, effect summary, search |
| Outputs | JSON object (parsed) | Detail drawer, variable index, search |

Missing required columns → the file is rejected with the list of missing headers. Unknown extra columns are kept and shown in the column picker.

Headers match ignoring case, spaces, underscores and a BOM (`Log index` = `LogIndex` = `log_index`). Required: Start time, End time, Subflow, Log index, Action index, Action display name, Status, Inputs, Outputs. Optional (empty when absent): Module name, Action name, Module display name, Log level, Log message. `Subflow name` is accepted as an alias for Subflow. A file with no data rows is rejected as empty.

### File name

Default format: `<flow-name>_<guid>_<export-timestamp>.csv`.

- Parse **from the right**: the last segment is the export timestamp, the one before it is the GUID, everything left of that is the flow name. Flow names can contain underscores.
- The GUID is matched with a strict 8-4-4-4-12 hex pattern; that anchors the split.
- A file that does not match the pattern is still accepted; the flow name falls back to the file name and the run start falls back to the first row's Start time.
- The GUID is the run id, unique per run, and is the run's key in history. The export timestamp only distinguishes exports: the same run exported twice shares a GUID, so dropping it again prompts "Replace or keep both".

### Parsing rules

- **Quoting:** RFC 4180; embedded quotes are doubled (`""`).
- **Encoding:** UTF-8 with optional BOM; non-ASCII (for example CJK file paths) must survive round-trip.
- **Inputs/Outputs:** JSON inside a CSV field. Each parameter is `{ localizedName, value, variableName }`. Parse failure keeps the raw string and flags the row.
- **Timestamps:** 7 fractional digits (.NET ticks). JavaScript `Date` keeps only milliseconds, so timestamps are parsed into BigInt ticks; durations under 1 ms stay accurate. Ticks count 100 ns since the Unix epoch, UTC. Accepted forms: ISO 8601 (`2026-10-01T09:15:30.1234567Z`, `T` or space, optional `Z`/`±hh:mm`, no zone = UTC) and US short (`10/1/2026 9:15:30.1234567 AM`); to be confirmed against real logs in M1b.
- **Bad cells:** a row with an unreadable Log index is skipped; an unreadable Start time falls back to End time (or run start), an unreadable End time to Start time. Both are reported as per-row issues rather than rejecting the file.
- **Truncation:** PAD shortens long values in the log, ending them with `...`. Such values are flagged and labelled "truncated by PAD" in the UI.
- **Ordering:** rows are sorted by Log index, never by Action index.

## Data model

Three in-memory types drive the UI (`LogRow`, `RunMeta`, `Annotation`); IndexedDB stores the raw CSV plus metadata, and everything else is re-derived on open.

### LogRow (in memory)

| Field | Type | Source |
| --- | --- | --- |
| `logIndex` | number | Log index |
| `actionIndex` | number | Action index |
| `subflow` | string | Subflow |
| `module`, `moduleDisplay` | string | Module name, Module display name |
| `action`, `actionDisplay` | string | Action name, Action display name |
| `level`, `message`, `status` | string | Log level, Log message, Status |
| `startTicks`, `endTicks` | bigint | Start/End time |
| `durationTicks` | bigint | derived: end − start |
| `offsetTicks` | bigint | derived: start − run start |
| `inputs`, `outputs` | `Param[]` | parsed JSON (`{ key, label, variable, value, truncated }`); `value` is text, non-strings stringified |
| `startIso`, `endIso` | string | Start/End time as in the file; empty when unreadable |
| `inputsRaw`, `outputsRaw` | string | Inputs/Outputs cell verbatim (Raw JSON view, malformed payloads) |
| `payloadMalformed` | boolean | Inputs or Outputs is not valid JSON |
| `truncated` | boolean | any value ends with PAD's `...` marker |
| `extra` | `Record<string, string>` | unknown extra columns by header |
| `effect` | string | derived one-line summary |
| `depth` | number | derived block nesting level |
| `isFailure` | boolean | derived from Status / Log level |
| `searchText` | string | derived lower-cased concatenation for search |

### RunMeta (in memory and stored)

`id` (run GUID from the file name; generated if the name doesn't match), `flowName`, `fileName`, `exportedAt`, `runStart`, `runEnd`, `durationTicks`, `rowCount`, `subflowCount`, `failureCount`, `overallStatus`, `importedAt`, `tags[]`, `displayName` (user-editable).

### IndexedDB schema (database `pad-log-viewer`, version 1)

| Store | Key | Contents | Indexes |
| --- | --- | --- | --- |
| `runs` | `id` | `RunMeta` | `importedAt`, `flowName`, `overallStatus` |
| `files` | `runId` | raw CSV text | none |
| `annotations` | auto | `{ runId, logIndex?, kind: bookmark \| note, text, createdAt }` | `runId` |
| `settings` | key | theme, column visibility, storage-warning dismissed | none |

Storing the raw CSV, not derived rows, keeps storage small (about 2–5 MB per 10,000-row run, to be measured) and lets a newer app version re-derive with improved logic.

## Processing pipeline

A dropped file passes through seven synchronous stages in `core/`, then the UI renders from the resulting run object. Target: under 1 second end to end for 10,000 rows on a standard corporate laptop.

1. **Read** — `File.text()` reads the file; the BOM is stripped.
2. **Identify** — `fileName.ts` extracts flow name, GUID and export timestamp; the GUID is checked against history for duplicates.
3. **Parse** — Papa Parse in array mode; `parseCsv.ts` maps the header row itself (so duplicate headers resolve predictably) and validates it against `schema.ts`.
4. **Normalize** — each raw row becomes a `LogRow`: integers parsed, timestamps converted to BigInt ticks, Inputs/Outputs parsed to `Param[]` with a `truncated` flag.
5. **Derive (per row)**
   1. Duration and offset from run start.
   2. Effect summary: for actions that write a variable, `variable ← value` (value cut to 80 characters); for conditionals, `Condition = value`; otherwise the first input.
   3. Block depth: +1 after a block-opening action (If, Loop, For each, Loop condition), −1 at the matching End. Opening and closing action names are a configurable list, to be confirmed against real logs.
   4. Failure flag from Status and Log level.
6. **Index (per run)**
   1. Variable index: variable name → ordered list of assignments (`logIndex`, value).
   2. Facet counts for subflow, module, status and level, for filter chips.
   3. Summary: total duration, time per subflow, top 10 slowest actions, first failure.
7. **Persist** — raw CSV and `RunMeta` are written to IndexedDB; the UI does not wait on this write.

Search runs on the precomputed `searchText` with a 150 ms debounce; filters compose as AND across facets and OR within a facet.

## Persistence and history

History lives in the browser's IndexedDB by default, with a one-click workspace export as the durable backup. Browser storage can be wiped on locked-down machines, and the app says so rather than failing silently.

| Layer | Role | Survives profile wipe / non-persistent VDI |
| --- | --- | --- |
| IndexedDB | Default working store, zero setup | No |
| Workspace export (`.padworkspace.json`) | Manual backup and restore; move history to another machine | Yes |
| Folder sync (File System Access API) | Auto-save to a user-picked folder, e.g. OneDrive | Yes — deferred to v2 |

**Storage health check on launch:**

- Call `navigator.storage.persist()` and `navigator.storage.estimate()`.
- Persistence denied or storage unavailable → yellow banner on Home: "History is kept in this browser only and may be cleared. Export your workspace regularly."
- Banner offers "Export now" and "Don't show again".
- If IndexedDB itself is unavailable, the app still works as a session-only viewer.

**Workspace bundle:** one JSON file holding every `RunMeta`, raw CSV and annotation, plus a schema version. Import merges by run id and asks before overwriting.

**Deletion:** per-run delete and "Clear all history" in settings, both with a confirmation dialog.

## UI design

The UI has two screens, Home and Run view, and is designed failure-first: opening a run answers "did it fail, where, and why" before anything else.

### Home screen

- **Drop zone** across the top: drag one or more CSVs, or click "Browse files". Invalid files show an inline error card naming the problem.
- **History list** below: one card per run with display name, flow name, run start, duration, status pill, failure count and tags. Newest first.
- **Controls:** search by name, filter by status and tag, sort by date or duration.
- **Footer:** storage indicator (used space, persistence state), Export workspace, Import workspace.

### Run view

**Header strip (sticky):** back to Home · display name (editable) · overall status pill · total duration · start and end time · actions · subflows · failures · warnings · Export filtered CSV.

| Tab | Answers | Content |
| --- | --- | --- |
| Overview (default) | Where did time go, what broke? | First-failure card with "Jump to row"; time per subflow (horizontal bars); top 10 slowest actions; status breakdown; module usage |
| Execution log | What exactly happened, in order? | Virtualized table with filter bar; the main working screen |
| Variables | What value did X have, and when? | Variable list with assignment counts; selecting one shows its assignment history with links to rows |
| Errors | Why did it fail? | Each failed row plus the 3 rows before it; Log message shown in full |

### Execution log table

| Column | Default | Notes |
| --- | --- | --- |
| # (Log index) | Visible | Sort key |
| Time | Visible | Relative to run start, `+mm:ss.fff`; hover shows absolute timestamp |
| Duration | Visible | Bar-in-cell scaled to the slowest action; sub-ms shown as `<1 ms` or µs |
| Subflow | Visible | Colour chip |
| Action | Visible | Module icon + Action display name, indented by block depth |
| Effect | Visible | e.g. `txt_ApiPayload ← "{ 'FilePath': …"` |
| Status | Visible | Icon + colour |
| Message | Visible | Log message, truncated with tooltip |
| Action index, Module/Action internal names, absolute times, Log level | Hidden | Enabled from the column picker |

**Filter bar:** search box · subflow chips · status chips · module chips · "Errors only" toggle · "Hide noise" toggle (collapses Set variable and If rows) · active-filter count with "Clear".

**Keyboard:** ↑/↓ moves the selected row, Enter opens the drawer, Esc closes it, `/` focuses search, `f` jumps to next failure.

### Row detail drawer

- Title: Action display name, status, duration, Log index.
- **Inputs** and **Outputs** as tables: Parameter (`localizedName`) · Variable · Value. Values over 200 characters collapse with "Show more"; truncated values carry a "truncated by PAD" badge.
- "Raw JSON" toggle showing a collapsible tree.
- Copy buttons per value and "Copy row as text" for pasting into tickets or Teams.
- Bookmark toggle and a note field, saved to history.
- Previous / Next buttons to step through rows without closing.

### Visual system

- **Status colours:** Succeeded green, Failed red, warning amber, unknown grey. Status is always paired with an icon so colour is never the only signal.
- **Subflow colours:** assigned from a 10-colour palette by hashing the subflow name, so `main` keeps its colour across runs.
- **Themes:** dark (default) and light, defined as CSS variables; contrast meets WCAG AA.
- **Type:** system UI font for text, monospace for values, variable names and timestamps.
- **Density toggle:** comfortable (40 px rows) and compact (28 px rows).

### Responsive behaviour

| Width | Layout |
| --- | --- |
| ≥ 1280 px | Table with drawer docked on the right (40% width) |
| 768–1279 px | Drawer slides over the table; fewer default columns |
| < 768 px | Rows render as cards (action, status, duration, effect); drawer is full screen |

The primary target is a 1366–1920 px laptop or monitor; small screens are functional, not optimised.

## Build, release and distribution

CI builds the single HTML file on every tagged release; reviewers download it and double-click it, and never touch Node, npm or a terminal.

**Contributor workflow (developers who change the app):** clone the private GitHub repo, `npm ci`, `npm run dev` for hot reload, `npm test` before a PR.

**Release workflow:**

1. Merge to `main` runs `ci.yml`: lint, type-check, unit tests, build, Playwright e2e against `dist/pad-log-viewer.html` opened via `file://`, bundle-size check.
2. A version tag (`v1.2.0`) runs `release.yml`: builds `pad-log-viewer-v1.2.0.html`, attaches it to the GitHub release with a changelog.
3. The maintainer uploads the same file to the team's SharePoint or Teams channel.

**Reviewer workflow:** download the HTML once → save it in a stable folder → double-click, or bookmark it in Edge. The app shows its version in the footer and a "What's new" note after an upgrade.

**Upgrade safety:** IndexedDB data is keyed to the page's origin. For `file://` pages that origin can depend on the file path \[to verify on target Edge\], so the reviewer guide tells users to replace the HTML in the same folder with the same file name, and to export the workspace before upgrading.

**Bundle budget:** 1.5 MB uncompressed HTML; CI fails above it.

**Distribution check before v1:** upload a test HTML to the team SharePoint, download it on a locked-down machine, and confirm it opens and runs. If SharePoint or Teams blocks HTML downloads, ship it inside a `.zip` instead.

## Security, performance and testing

The app makes zero network requests, and real client logs never enter the repository.

### Security and data handling

- **No network:** a Content-Security-Policy meta tag sets `default-src 'none'` with inline script and style allowed, so any accidental fetch fails. Playwright asserts zero network requests.
- **No telemetry,** no analytics, no external fonts.
- **Rendering:** all log values render as text, never as HTML, so a malicious value in a log cannot inject script.
- **Repo hygiene:** the repo is private on github.com (anirbandas59/pad-log-viewer) and holds code and sanitized fixtures only. Raw logs contain client project ids, usernames and file paths; only output of `scripts/sanitize-log.ts` goes into `tests/fixtures/`. `npm run sanitize -- <log.csv> --terms "Client,Machine"` replaces GUIDs, paths, URLs, e-mails, `DOMAIN\account` names, user and host names learned from those, and the given terms with stable pseudonyms; it keeps timestamps, indexes, statuses, CSV shape and JSON validity, and refuses to write if a known secret survives. Free-text names it cannot recognise need `--terms`, so the output is always read before committing. A pre-commit check rejects CSVs outside that folder.
- **Retention:** users control deletion; the reviewer guide reminds them that history holds client data.

### Performance budgets (10,000-row run, standard corporate laptop)

| Operation | Budget |
| --- | --- |
| Parse and derive | < 1 s |
| First render of run view | < 300 ms after parse |
| Scroll | 60 fps, no blank rows |
| Filter / search update | < 100 ms after debounce |
| Open drawer | < 50 ms |
| Memory per open run | < 100 MB |

If parse and derive exceed budget on real logs, the fallback is moving stages 3–6 into an inlined Blob-URL worker.

### Testing strategy

| Level | Tool | Covers |
| --- | --- | --- |
| Unit | Vitest | File-name parsing, tick arithmetic, JSON-in-CSV parsing, truncation flag, effect summary, block depth, variable index |
| Fixture | Vitest + sanitized CSVs | Small run, 10k-row run, failed run, nested blocks, CJK paths, malformed JSON, missing columns, BOM |
| End to end | Playwright on built HTML via `file://` | Drop file → overview → filter → drawer → export; history persists across reload; zero network calls |
| Manual | Locked-down laptop and VDI | Opening from download, IndexedDB availability, storage banner |

## Risks and open questions

The biggest risks are environmental (what a locked-down browser allows), not technical; each has a check to run before v1 work starts.

| Risk | Impact | Mitigation / check |
| --- | --- | --- |
| IndexedDB disabled or wiped by policy or non-persistent VDI | History lost silently | Storage health banner; workspace export; test on a real VDI |
| `file://` origin tied to file path | History "disappears" after an upgrade saved elsewhere | Reviewer guide: replace in place; verify on target Edge |
| SharePoint / Teams / Outlook block HTML files | Reviewers can't get the app | Distribution check; `.zip` fallback |
| Block-depth rules wrong for real PAD logs | Misleading indentation | Confirm opening and closing action names on a log with nested If/Loop blocks; ship indentation behind a toggle |
| Export format changes between PAD versions | Parse failures | Header-name mapping, extra columns tolerated, clear error for missing ones |
| Raw client logs committed to the repo | Client data incident | Private repo, sanitizer, pre-commit hook |

**Open questions**

- [ ] Should History group runs by flow name, or stay a single list sorted by date?
- [ ] What is the exact export-timestamp format in the file name?
- [ ] Which action names open and close blocks in the CSV (If, Else, Loop, For each, End)?
- [ ] Do reviewers use Edge, Chrome or both on target machines?

## Roadmap after v1

1. **v1.1** — Timeline view (subflow lanes, action bars by time); folder sync to a chosen folder.
2. **v2** — Two-run diff: Myers diff per subflow on the action signature (Subflow + Module + Action), loops collapsed first; covers same-version and changed-flow comparisons.
3. **v3** — Optional direct pull of run logs from Dataverse; requires sign-in and is a separate architecture decision.
