# V2 search and ownership review

Local design review only. Product-contract changes below are AWAITING_TEAM_APPROVAL.

## Search

The shared `src/core/session-search-query.ts` owns lexical parsing and literal LIKE escaping. PostgreSQL UI search imports it directly; the standalone MCP binary imports its generated MCP bundle. No database, Electron, UI, or runtime dependencies belong in this module. The package build includes that entry; the source-only MCP executable requires a build first, as its other bundled features already do.

The six characterization cases were run before extraction and retained afterward: empty input, duplicate AND terms, ignored unquoted single Unicode characters, explicit quoted single characters/phrases, quoted AND's existing operator treatment, and literal percent/underscore/backslash escaping. This preserves existing behavior; it does not claim complete UI/MCP result parity.

| Contract | UI repository | Standalone MCP |
| --- | --- | --- |
| Text matching | all clauses in one Turn OR all in session metadata | all clauses in concatenated Turn + selected metadata |
| Metadata | includes project path/raw ID | title/first question/summary, not project/raw ID |
| Visibility | hidden excluded by default; explicit visibility option | no visibility filter |
| Source | grouped available-source aliases | exact source |
| Project | exact path | substring LIKE pattern |
| Ranking | title relevance, favorite/activity and UI sort mode | trigram similarity, then file modification time |
| Result shape | total/paging/hit snippets/best Turn | capped lightweight session summaries |

These differences are verified from the current SQL, not declared intentional by the team. They can cause different results, including mixed metadata/body clauses. V1 was inspected: it owns a SQLite FTS5 path and cannot consume PostgreSQL SQL. No V1 behavior is changed by this V2 extraction.

Proposed next boundary: a backend-only SessionSearchService accepts a normalized request with explicit match scope, visibility, source grouping and ranking policy. It delegates one predicate builder to the repository and maps either detailed UI results or lightweight MCP summaries. Do not import the UI repository wholesale into the MCP server: that would silently change filters, project matching, totals work, and ranking. Before unification, team agreement and a parity matrix must cover hidden/favorites, zero-Turn metadata-only rows, mixed metadata/body clauses, cross-Turn clauses, project wildcard literals, source aliases, empty query, tie order and limit/offset. No migration or vector reintroduction is needed.

The current task deliberately shares only the proven equivalent lexical boundary. Remaining semantic convergence is a proposal, not a completed feature.

## Large-file ownership audit

Counts from the local pre-extraction source (TypeScript AST import declarations, not guesses from filenames):

| File | Lines | Imports | Node / Electron imports | State and boundary |
| --- | ---: | ---: | ---: | --- |
| main/index.ts | 3,358 | 111 | 8 / 1 | app/window/tray, DB startup/shutdown, index timers/coordinator, services, 21 inline IPC handlers plus domain registrars |
| renderer/src/App.tsx | 2,580 | 53 | 0 / 0 | 71 useState calls; selected page/session, filters, dialogs, async workbench feeds; feature hooks/pages already extracted |
| engine/main/hub/agent-hub.ts | 3,822 | 90 | 3 / 0 | runtime/chat/task/team maps, workflow coordinators, active stops/listeners, persistence and streaming timers, runtime drivers/router |
| workflows/v2/workflow-v2-run-executor.ts | 2,067 | 41 | 3 / 0 | execute owns transactional node attempts, review/savepoint/recovery routing, audit traces, cancellation and persistence ordering |

Retained extraction: native application menu registration into `src/main/application-menu.ts`. It owns OS menu presentation/roles/accelerators; composition root supplies settings and refresh commands. Window ownership stays in main, and refresh still explicitly bypasses failure backoff. It does not own timers or introduce another state copy. Three characterization tests against the original function passed before extraction; the same assertions now call the module directly with mocked Electron. Linux/Windows still remove the native menu. No IPC contracts changed.

Deferred boundaries (not mechanical line-count targets):

- Main: extract a window lifecycle owner only after testing startup failure, quick-search focus, zoom, close-to-tray, restore bounds, and pending shutdown. Retain one owner for DB/runtime stop and timer cleanup. Domain IPC registrars already exist; move remaining handlers only with service-level transactional characterization.
- App: workbench feed loading is the next viable hook (one request/cancellation owner); preserve page switching/unmount race tests before moving it. Dialog host extraction should not duplicate authoritative selected-session state. Keep typed preload contracts; no Node/Electron imports in React.
- AgentHub: convert to a thinner facade by moving one coordinator plus its owned maps/timers together, not copying maps into services. Persist/emit order, active stop cleanup, idle sweep and shutdown require tests before each move.
- Workflow executor: first codify a transition table for attempt/review/recovery/cancellation and committed side effects. Splitting the long execute body before that risks changing transaction/savepoint ordering. Existing helpers/coordinators already form useful boundaries; no state-machine rewrite performed here.

These follow-ups are optional team-reviewed work, not hidden unfinished implementation in this branch.
