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
| Table | Column model in `core/derive/columns.ts`, rendered by hand over TanStack Virtual | Rows are always in Log index order, so there is no sorting to delegate; filtering is `filterRows` in core. TanStack Table (now v9, a new API) was not adopted in M6 |
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
│  │  │  ├─ summary.ts          # run-level metrics, slowest actions
│  │  │  ├─ search.ts           # lower-cased search text per row
│  │  │  ├─ overview.ts         # subflow bars and colours, facet breakdowns
│  │  │  └─ deriveRun.ts        # stages 5–6 over a normalized run
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

Portal export format: `<flow-name>-<run-guid>-<export-timestamp>.csv`, e.g. `Invoice_Main-4c766126-8e2d-47cc-bc49-6f15ac34b689-20261012T113808Z.csv` (confirmed on a real export, 2026-10-13). The export timestamp is UTC, `yyyyMMdd'T'HHmmss'Z'`. The `_`-separated form `<flow-name>_<guid>_<export-timestamp>.csv` is also accepted.

- Parse **from the right**: the last segment is the export timestamp, the one before it is the GUID, everything left of that is the flow name. Flow names can contain underscores and hyphens.
- The GUID is matched with a strict 8-4-4-4-12 hex pattern; that anchors the split.
- A file that does not match the pattern is still accepted; the flow name falls back to the file name and the run start falls back to the first row's Start time.
- The GUID is the run id, unique per run, and is the run's key in history. Duplicates are spotted by comparing the run GUID **and** the export timestamp (`isSameExport` / `isSameRun` in `fileName.ts`):
  - same GUID and same export timestamp: the same export dropped again; it is already in history.
  - same GUID, different export timestamp: the same run exported again; dropping it offers **Replace** only (v1, decided 2026-10-13). "Keep both" would need a history key other than the run GUID, a data-model change deferred past v1.

### Parsing rules

- **Separator line:** portal exports start with an Excel hint line `sep=,` (after the BOM), before the header row. It is skipped, and its delimiter is used; without it the delimiter is auto-detected.
- **Quoting:** RFC 4180; embedded quotes are doubled (`""`).
- **Encoding:** UTF-8 with optional BOM; non-ASCII (for example CJK file paths) must survive round-trip.
- **Inputs/Outputs:** JSON inside a CSV field. Each parameter is `{ localizedName, value, variableName }`. Parse failure keeps the raw string and flags the row.
- **Timestamps:** 7 fractional digits (.NET ticks). JavaScript `Date` keeps only milliseconds, so timestamps are parsed into BigInt ticks; durations under 1 ms stay accurate. Ticks count 100 ns since the Unix epoch, UTC. Accepted forms: ISO 8601 (`2026-10-01T09:15:30.1234567Z`, `T` or space, optional `Z`/`±hh:mm`, no zone = UTC) and US short (`10/1/2026 9:15:30.1234567 AM`); to be confirmed against real logs in real-log validation before v1 (deferred M1b). One real export (2026-10-13) uses ISO 8601 with 7 fractional digits and `Z`.
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

`id` (run GUID from the file name; if the name doesn't match, `local-<16 hex>` hashed from the file content, so the same file dropped again under any name is still recognised — `contentRunId` in `ingest.ts`), `flowName`, `fileName`, `exportedAt`, `runStart`, `runEnd`, `durationTicks`, `rowCount`, `subflowCount`, `failureCount`, `overallStatus`, `importedAt`, `tags[]`, `displayName` (user-editable).

### IndexedDB schema (database `pad-log-viewer`, version 1)

| Store | Key | Contents | Indexes |
| --- | --- | --- | --- |
| `runs` | `id` | `RunMeta` | `importedAt`, `flowName`, `overallStatus` |
| `files` | `runId` | raw CSV text | none |
| `annotations` | auto | `{ runId, logIndex?, kind: bookmark \| note, text, createdAt }` | `runId` |
| `settings` | key | theme, column visibility, storage-warning dismissed | none |

`files` and `settings` use out-of-line keys (the value is the CSV text or the setting itself). `db.ts` migrates with one `oldVersion < N` step per schema version, so an older database replays every step in order. Deleting a run removes its file and annotations in the same transaction; "Clear all history" keeps settings.

Storing the raw CSV, not derived rows, keeps storage small (about 2–5 MB per 10,000-row run, to be measured in real-log validation before v1) and lets a newer app version re-derive with improved logic.

## Processing pipeline

A dropped file passes through seven synchronous stages in `core/`, then the UI renders from the resulting run object. Target: under 1 second end to end for 10,000 rows on a standard corporate laptop.

1. **Read** — `File.text()` reads the file; the BOM is stripped.
2. **Identify** — `fileName.ts` extracts flow name, GUID and export timestamp; the GUID is checked against history for duplicates.
3. **Parse** — Papa Parse in array mode; `parseCsv.ts` maps the header row itself (so duplicate headers resolve predictably) and validates it against `schema.ts`.
4. **Normalize** — each raw row becomes a `LogRow`: integers parsed, timestamps converted to BigInt ticks, Inputs/Outputs parsed to `Param[]` with a `truncated` flag.
5. **Derive (per row)**
   1. Duration and offset from run start.
   2. Effect summary: for actions that write a variable, `variable ← value` (value cut to 80 characters, whitespace folded to one line, quoted unless a number or boolean); for conditionals and Switch, `<first input label> = value` (e.g. `Condition = False`); for Case, its operator and value (`= BUSINESS`); otherwise `<first input label>: value`.
   3. Block depth: worked out per subflow from Action index, which is the source line (`blocks.ts`), because a running +1 after a block-opening action and −1 at the matching End drifts on real logs. PAD logs only executed actions: a false If jumps past its body **and its End**; loops log their opener and End on every pass; Exit loop / Next loop jump to the loop's End (logged) and skip the Ends of the blocks they leave; Go to leaves blocks without an End. A real 1,235-row export (2026-10-13) logged 154 `FlowControl.End` rows against about 320 possible openers (`Conditionals.If` 155, `Loops.Foreach` 57, `FlowControl.Block` 49, `Loops.Loop` 24, `System.IfProcessAction` 18, `File.IfFileAction` 11, `Folder.IfFolderExistsAction` 4, `Conditionals.Switch` 2), plus mid-block `Conditionals.Else` / `Conditionals.Case`, `Loops.Break` / `Continue` and `FlowControl.GoTo` / `Label`. Opening and closing action names are a configurable list, to be confirmed against more real logs in real-log validation before v1 (deferred M1b).
      - Evidence from the log order: an End followed by a loop opener on an earlier line is that loop's End; an End right after Exit/Next loop is the innermost loop's End; a conditional whose next executed line skips ahead (and is not Else/Case) ends before that line, unless its logged Condition is `True` (`Conditionals.If` logs the evaluated condition as its input); a Go to that jumps forward closes every open block.
      - A sweep over the subflow's executed lines in source order keeps a stack of open blocks and gives each line the number of blocks open around it. Else/Case take their opener's depth; End takes the depth outside its block.
      - Every pass of a loop gets the same depth, and depth cannot drift into another subflow. Default action lists (`DEFAULT_DEPTH_RULES`, `Module.Action` patterns): loops `Loops.Loop`, `Loops.Foreach`, `Loops.LoopCondition`; conditionals `*.If*`; blocks `FlowControl.Block`, `Conditionals.Switch`; middles `Conditionals.Else`, `ElseIf`, `Case`, `DefaultCase`; ends `FlowControl.End`; loop exits `Loops.Break`, `Loops.Continue`; go to `FlowControl.GoTo`.
      - Checked against the synthetic nested fixture and hand-worked spans of the real export (`tests/unit/fixtures/realDepth.test.ts`). Still best-effort: an End skipped by a jump with no other evidence (e.g. a true block left by an error handler) leaves its block open until the subflow's last line.
   4. Failure flag from Status and Log level.
6. **Index (per run)**
   1. Variable index: variable name → ordered list of assignments (`logIndex`, subflow, value, truncated), taken from every output parameter that names a variable; names in order of first assignment.
   2. Facet counts for subflow, module (display name), status and level, for filter chips, in order of first appearance.
   3. Summary: total duration, time per subflow, top 10 slowest actions (ties by Log index), first failure, failure and warning counts, overall status (`Failed` if any row is a failure, `Unknown` for no rows, else `Succeeded`). Time per subflow gives each row the wall-clock span from its start to the next row's start (the last row: to run end), so a Run subflow action is not counted twice and the parts sum to the run duration.
   4. Search text: lower-cased subflow, module and action names, level, status, message, effect and every parameter's label, variable and value (raw Inputs/Outputs when malformed), joined by newlines so a query cannot match across fields.
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

- Call `navigator.storage.persist()` and `navigator.storage.estimate()`. `persisted()` is checked first, so a browser that already granted persistence is not asked again; a Storage API call that throws or is missing counts as not persistent (`persistence.ts`).
- Persistence denied or storage unavailable → yellow banner on Home: "History is kept in this browser only and may be cleared. Export your workspace regularly."
- Banner offers "Export now" and "Don't show again".
- If IndexedDB itself is unavailable, the app still works as a session-only viewer.

**Workspace bundle:** one JSON file holding every `RunMeta`, raw CSV and annotation, plus a schema version. Import merges by run id and asks before overwriting.

- Layout (`workspace.ts`): `{ format: "pad-log-viewer-workspace", schemaVersion: 1, exportedAt, runs: [{ meta, csv, annotations }] }`, saved as `pad-log-viewer-<yyyy-mm-dd>.padworkspace.json`. Export reads all stores in one transaction, so the bundle is a consistent snapshot, and leaves out (and reports) any run whose raw CSV is missing rather than exporting a run that cannot be re-derived. BigInt tick fields of `RunMeta` are written as decimal strings, since JSON numbers would lose precision. Annotations carry no `id` or `runId`: ids are regenerated on import and the run id is the parent run's.
- The file is untrusted input: `parseWorkspace` checks every field, drops unknown ones, refuses a run id that appears twice and negative tick values, and refuses a bundle with a newer `schemaVersion` than the app knows (asking the user to update) rather than half-reading it.
- `planImport` lists new runs and runs already in history; the UI asks about the latter, and `importWorkspace` replaces (meta, CSV and annotations together) only the ids the user confirmed, in one transaction. Local runs not in the bundle are kept.

**Deletion:** per-run delete and "Clear all history" in settings, both with a confirmation dialog.

## UI design

The UI has two screens, Home and Run view, and is designed failure-first: opening a run answers "did it fail, where, and why" before anything else.

### Home screen

- **Drop zone** across the top: drag one or more CSVs, or click "Browse files". Invalid files show an inline error card naming the problem (not a `.csv`, missing columns, no readable rows); valid files in the same drop are still added. `ingest.ts` turns each file into a `RunMeta` (stages 1–4 plus the run summary); `classifyDrop` decides what happens next:
  - new run: saved to history;
  - same export dropped again: a note says it is already in history, nothing changes;
  - re-export of a stored run: a dialog offers **Replace** or Cancel (no "keep both" in v1). Replace keeps the stored run's display name, tags, bookmarks and notes.
- **History list** below: one card per run with display name, flow name, run start, duration, status pill, failure count and tags. Newest first.
- **Controls:** search by name, filter by status and tag, sort by date or duration.
- **Footer:** storage indicator (used space, persistence state), Export workspace, Import workspace, Clear all history. Workspace import asks once whether to overwrite the runs already in history ("Overwrite" / "Keep mine"); export and import are off in session-only mode.
- **Session-only mode:** when IndexedDB cannot be opened, runs are kept in memory for the tab and the banner says so instead of offering "Don't show again".

### Run view

**Header strip (sticky):** back to Home · display name (editable) · overall status pill · total duration · start and end time · actions · subflows · failures · warnings · Export filtered CSV (M7).

Opening a run re-derives its stored CSV (`deriveCsv`: parse, normalize, derive) after a "Reading the log…" state has painted; a CSV that no longer parses shows an error in place of the tabs. Renaming saves `displayName` to history (`updateRun`). The tabs follow the WAI-ARIA tabs pattern (arrow keys, Home, End).

**Overview (M5):**
- First-failure card: the lowest-Log-index failure with its subflow, offset, status and Log message, or "No failures in this run". **Jump to row** opens the Execution log with that row selected and scrolled to the centre; each top-10 slowest action jumps the same way.
- Time per subflow: one bar per subflow, largest first, from the run summary's wall-clock split, so the bars sum exactly to the run duration (`subflowBars`); bar colour from the 10-colour subflow palette (`subflowColor`, CSS tokens `--subflow-0` … `--subflow-9`).
- Status breakdown (bars in status colours) and module usage (top 8, the rest folded into "Other"; `facetEntries`).

| Tab | Answers | Content |
| --- | --- | --- |
| Overview (default) | Where did time go, what broke? | First-failure card with "Jump to row"; time per subflow (horizontal bars); top 10 slowest actions; status breakdown; module usage |
| Execution log | What exactly happened, in order? | Virtualized table with filter bar; the main working screen |
| Variables | What value did X have, and when? | Variable list with assignment counts; selecting one shows its assignment history with links to rows |
| Errors | Why did it fail? | Each failed row plus the 3 rows before it; Log message shown in full |

As built (M7):

- **Variables:** `variableSummaries` lists the variable index in order of first assignment, with assignment count and last value, filtered by a name search. Choosing one shows its assignments in Log index order (virtualized, so a variable written on every row stays fast), each with "Go to row #N", its subflow, the value as text and the "truncated by PAD" badge.
- **Errors:** `errorContexts` gives each failed row in Log index order with the up to 3 rows just before it (another failure can be one of them); the card shows the Log message in full and "Jump to row". A run without failures says "No failures in this run."
- **Jump to row** (Overview, Variables, Errors) clears the execution-log filters when they would hide the target row.
- **Export filtered CSV** (run header) downloads the rows that pass the current filters, bookmark filter included. `rowsToCsv` writes them back as read (timestamps and Inputs/Outputs verbatim, the PAD columns in portal order, extra columns after them, BOM and `sep=,` line, CRLF), so they parse to the same rows; tests round-trip every row of the committed fixtures cell for cell. The file is `<flow>-filtered-<yyyyMMddTHHmmssZ>.csv`: it carries no run GUID on purpose, so dropping it back in stores it as a run of its own (keyed by content hash) instead of offering to Replace the full run with the subset. Like the portal export, cells are not escaped against spreadsheet formulas, since that would change the values.

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

As built (M6):

- Rows are virtualized with TanStack Virtual at fixed heights (table rows 40 px, or 28 px compact, from M7; 88 px cards), so nothing is measured while scrolling. The grid (`role="grid"`) holds a sticky header row; `aria-rowcount` counts it with the rows shown, the header is row 1 and data rows follow, and `aria-activedescendant` names the selected row while it is rendered (M7); columns come from `LOG_COLUMNS` and keep their grid tracks, and the table scrolls sideways inside its own box when the columns are wider than it. Time is `formatOffset` (`+mm:ss.fff`, `+h:mm:ss.fff` past an hour) with the exported timestamp as a tooltip; the Duration bar is scaled to the run's slowest action. The module icon in the Action column is not built yet.
- Filtering is `filterRows` in core: search terms are split on whitespace and all must occur in the row's `searchText`; facets OR within a facet and AND across facets; Errors only keeps `isFailure` rows; Hide noise drops `Variables.SetVariable`/`Assign` and `Conditionals.If`/`Else`/`ElseIf` (`isNoise`). Status chips use `rowStatusKind`: Failed (`isFailure`), Warning (Log level contains "warn"), Succeeded, Unknown. Subflow and module chips are checkbox lists behind "Subflows" and "Modules" buttons, with row counts. Search is debounced 150 ms. Each filter change is timed from the store update to the table's commit as the `pad:filter` performance measure (budget < 100 ms).
- The count reads "N of M rows"; the active-filter count is the search (1), each chosen facet value and each toggle. "Clear filters" also clears the search box.
- Column visibility is saved to the `settings` store under `logColumns` (best effort, read at start-up with `readColumnVisibility`); the Action column cannot be hidden.
- Selection lives in the store. `jumpToRow` also bumps a jump counter, so jumping to the row that is already selected still scrolls it to the centre. ↑/↓ (`stepSelection`) and `f` (`nextFailure`, wrapping round) work over the filtered rows; ↑/↓ and Enter apply when the table has focus, `/`, `f` and Esc anywhere on the tab except in a text field or while a dialog is open.

### Row detail drawer

- Title: Action display name, status, duration, Log index.
- **Inputs** and **Outputs** as tables: Parameter (`localizedName`) · Variable · Value. Values over 200 characters collapse with "Show more"; truncated values carry a "truncated by PAD" badge.
- "Raw JSON" toggle showing a collapsible tree.
- Copy buttons per value and "Copy row as text" for pasting into tickets or Teams.
- Bookmark toggle and a note field, saved to history.
- Previous / Next buttons to step through rows without closing.

As built (M6): parameters list Parameter · Variable · Value with a copy button each; a payload that is not JSON is shown as its raw text. "Raw JSON" swaps both tables for `JsonTree` (`role="tree"`, branches open two levels deep). "Copy row as text" uses `rowAsText` and the Clipboard API, falling back to `execCommand('copy')`, with a "Copied" status message. Previous / Next step through the filtered rows.

As built (M7): a "Bookmark" toggle and a "Note" box per row (`NoteEditor`). The note saves 400 ms after typing stops, on blur, and when the drawer moves to another row or closes, and shows "Saved" or "Not saved". A row keeps at most one bookmark and one note in the `annotations` store (`nextRowAnnotations`; `replaceRowAnnotations` swaps a row's annotations in one transaction); clearing the note deletes it. Saves run one at a time, each applied to the row as last saved (`setRowMark` reads the stored annotations in its turn), so a note followed at once by a bookmark click keeps both, and the bookmark toggles against the saved state. Run-level notes (`logIndex` absent) are in the model but have no UI yet. Bookmarked and noted rows show markers in the # column and on cards, and "Bookmarked" in the filter bar keeps only bookmarked rows. In session-only mode annotations are kept in memory.

### Visual system

- **Status colours:** Succeeded green, Failed red, warning amber, unknown grey. Status is always paired with an icon so colour is never the only signal.
- **Subflow colours:** assigned from a 10-colour palette by hashing the subflow name, so `main` keeps its colour across runs.
- **Themes:** dark (default) and light, defined as CSS variables; contrast meets WCAG AA. The toggle sets `data-theme` on `<html>`. The choice is saved in localStorage, which is read before the first paint and wins at startup, and copied to the `settings` store, which restores it only when localStorage is empty (`app/theme.ts`). A toggle made before the database opens is therefore kept, and later written to the store.
- **Type:** system UI font for text, monospace for values, variable names and timestamps.
- **Density toggle:** comfortable (40 px rows) and compact (28 px rows). As built (M7): "Compact rows" in the filter bar; saved to the `settings` store as `logDensity`; table rows only (cards stay 88 px).

### Responsive behaviour

| Width | Layout |
| --- | --- |
| ≥ 1280 px | Table with drawer docked on the right (40% width) |
| 768–1279 px | Drawer slides over the table; fewer default columns |
| < 768 px | Rows render as cards (action, status, duration, effect); drawer is full screen |

As built (M6): the app header is sticky (3.5 rem) and the drawer opens below it, so the theme switch stays reachable; the run view widens to 110 rem. At 768–1279 px the drawer is a fixed panel up to 32 rem wide over the table; the table keeps the same default columns and scrolls sideways inside its box instead of dropping columns.

As built (M7): the run header strip is sticky (below the app header) from 768 px only; on phones it is too tall to keep on screen.

The primary target is a 1366–1920 px laptop or monitor; small screens are functional, not optimised.

## Build, release and distribution

CI builds the single HTML file on every tagged release; reviewers download it and double-click it, and never touch Node, npm or a terminal.

**Contributor workflow (developers who change the app):** clone the private GitHub repo, `npm ci`, `npm run dev` for hot reload, `npm test` before a PR.

**Release workflow:**

1. Merge to `main` runs `ci.yml`: lint, type-check, unit tests, build, Playwright e2e against `dist/pad-log-viewer.html` opened via `file://`, bundle-size check. As built (M8): `playwright.config.ts` runs every browser test twice, as project `preview` (`vite preview`, http) and project `file` (`file://…/dist/`), so the existing `e2e` job covers `file://` without a workflow change.
2. A version tag (`v1.2.0`) runs `release.yml`: builds `pad-log-viewer-v1.2.0.html`, attaches it to the GitHub release with a changelog.
3. The maintainer uploads the same file to the team's SharePoint or Teams channel.

**Reviewer workflow:** download the HTML once → save it in a stable folder → double-click, or bookmark it in Edge. The app shows its version in the footer and a "What's new" note after an upgrade.

As built (M8): the version (`package.json`, injected at build time as `__APP_VERSION__`) shows in the Home footer; "What's new" is a README section, not an in-app note, in v1. The reviewer guide is in the README and tells reviewers to save every version as `pad-log-viewer.html` in the same folder, since stored history follows the file's location.

**Upgrade safety:** IndexedDB data is keyed to the page's origin. For `file://` pages that origin can depend on the file path \[to verify on target Edge\], so the reviewer guide tells users to replace the HTML in the same folder with the same file name, and to export the workspace before upgrading.

**Bundle budget:** 1.5 MB uncompressed HTML; CI fails above it.

**Distribution check before v1:** upload a test HTML to the team SharePoint, download it on a locked-down machine, and confirm it opens and runs. If SharePoint or Teams blocks HTML downloads, ship it inside a `.zip` instead.

## Security, performance and testing

The app makes zero network requests, and real client logs never enter the repository.

### Security and data handling

- **No network:** a Content-Security-Policy meta tag sets `default-src 'none'` with inline script and style allowed, so any accidental fetch fails. Playwright asserts zero network requests.
  - As built (M8), stricter than that: the build (`shipHtml` in `vite.config.ts`, `scripts/lib/csp.ts`) puts the policy right after `<meta charset>` and allows the one inline script and the one stylesheet by SHA-256 hash, not `'unsafe-inline'`: `default-src 'none'; script-src 'sha256-…'; style-src 'unsafe-inline'; style-src-elem 'sha256-…'; style-src-attr 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'`. Style attributes stay allowed because React sets them; `style-src 'unsafe-inline'` is only the fallback for browsers without `style-src-elem`. No `'unsafe-eval'`. Downloads (CSV, workspace) are `blob:` links, which CSP does not govern.
  - The build fails if the page would load anything from outside itself (any `src`/`href` other than `data:` or `#`) or writes any file besides the HTML; the icon is an inline `data:` SVG and `publicDir` is off.
  - `tests/e2e/ship.spec.ts` opens `dist/pad-log-viewer.html` from `file://`, walks drop → overview → log → filter → drawer → note → export → Variables → Errors → reload, and asserts no request other than the file itself and `data:`/`blob:` URLs, no CSP violation and no console error; a second test shows `fetch` and an `<img>` to an https URL are blocked by the CSP before they are sent.
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
| End to end | Playwright on built HTML via `file://` | Drop file → overview → filter → drawer → export; history persists across reload; zero network calls. `npm run test:e2e` runs `tests/e2e/` against the built file twice: served by `vite preview` and, from M8, opened from `file://` (`playwright.config.ts` projects `preview` and `file`) |
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
- [x] What is the exact export-timestamp format in the file name? `yyyyMMdd'T'HHmmss'Z'`, UTC, in `<flow>-<guid>-<timestamp>.csv` (real export, 2026-10-13).
- [ ] Which action names open and close blocks in the CSV (If, Else, Loop, For each, End)? (real-log validation before v1)
- [ ] Do reviewers use Edge, Chrome or both on target machines?

## Roadmap after v1

1. **v1.1** — Timeline view (subflow lanes, action bars by time); folder sync to a chosen folder.
2. **v2** — Two-run diff: Myers diff per subflow on the action signature (Subflow + Module + Action), loops collapsed first; covers same-version and changed-flow comparisons.
3. **v3** — Optional direct pull of run logs from Dataverse; requires sign-in and is a separate architecture decision.
