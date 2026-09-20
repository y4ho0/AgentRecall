# AgentRecall v2 local staged review

Publication status: AWAITING_TEAM_APPROVAL. All work and checkpoints are local.

## Baseline

Started from 047e2152 on fix/v2-postgres-oversized-turn, with exactly four previously validated PostgreSQL fix files uncommitted. Saved those as 665fc4cb (`checkpoint: local postgres oversized session indexing baseline`). No unrelated working-tree changes were present.

Tests run with a dedicated temporary HOME and AGENT_RECALL_TEST_HOME. Native Electron tests additionally require explicit AGENT_RECALL_HOME_DIR, AGENT_RECALL_APP_DATA_DIR and AGENT_RECALL_USER_DATA_DIR; HOME alone is not sufficient isolation on macOS. No real application data or installed application is a test target.

## Phase 1 — BASELINE PASS

- Migration 56 unchanged; drops unused generated vector and its GIN index, preserves full search_text and trigram index. Historical migrations remain unchanged.
- Command (apps/main-2.0): `npm exec vitest run src/core/postgres/schema.test.ts src/core/indexer.test.ts src/core/postgres/session-search.test.ts` with isolated HOME.
- Result: 3 files, 68 tests PASS, including fresh schema, 55→56 data preservation, 3,250,033-byte single Turn, exact message readback, end marker UI/MCP searches and three indexes.
- Database: isolated PGlite, no external connection. Prior turn also verified native embedded PostgreSQL failure/recovery; final regression will recheck current code.
- Real user data touched: NO. Risk: production migration needs a table lock; production upgrade intentionally not performed.
- Git after checkpoint: clean; diff empty.

## Phase 2 — PASS

- Investigation: CLI discovery happened inside a login shell, execution happened outside it. V1 has analogous code, but this Goal targets V2 desktop integration only.
- Change: perform discovery, exec, and absolute Node/CLI fallback inside one login shell; pass baked paths as quoted positional arguments and forward caller arguments.
- Regression uses a temporary ZDOTDIR and .zprofile, a fake CLI with `#!/usr/bin/env node`, Node exposed only by login PATH, paths/arguments with spaces, and parent PATH=/usr/bin:/bin. Old execution pattern fails with exit 127; fixed launcher succeeds. Fallback and missing CLI tested.
- Command: `node --test scripts/install-macos-app.test.mjs`. Result: 8/8 PASS on macOS.
- Real user data touched: NO. No real shell startup file changed. Risk: user login-shell configuration can itself fail; fallback runs when CLI cannot be resolved.
- Files: bin/install-macos-app.cjs, scripts/install-macos-app.test.mjs, existing V2 release note, this report. Changes reviewed with git diff --check before local checkpoint.

## Pending phases

3 retry aggregation/backoff; 4 real macOS bundle; 5 search semantic audit; 6 responsibility extraction; 7 incremental UI/IA; final regression.

## Remote freeze

Remote branches created: NO
Remote pushes performed: NO
Pull Requests created/updated: NO
Issues created/updated: NO
Releases published: NO
Packages published: NO

Team discussion and any later publication: AWAITING_TEAM_APPROVAL.
