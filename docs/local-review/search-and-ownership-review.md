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
