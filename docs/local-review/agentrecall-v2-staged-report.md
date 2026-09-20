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

## Phase 3 — PASS

- Investigation: V2 already isolates per-session indexing errors, but appended identical diagnostics each scan. V1 uses a different synchronous SQLite indexing path; this change is intentionally limited to V2's asynchronous PostgreSQL failure handler and diagnostics.
- Changes: fingerprint includes source/session/path/revision/normalized error; serialized atomic JSONL updates preserve firstSeen, update lastSeen and count. One bounded rotation remains. Process-owned retry state uses 30 seconds exponential backoff capped at 15 minutes, bounded to 1,000 entries. File mtime/size changes, explicit Refresh Now, and a new application process bypass previous waits; success clears state. No persistent blacklist or database migration.
- Tests: isolated `npm exec vitest run src/core/session-index-failures.test.ts src/core/indexer.test.ts src/main/session-index-failure-log.test.ts`: 42 tests PASS. `npm run typecheck`: PASS (625 production modules). After strengthening the oversized-turn regression, full indexer.test.ts rerun: 37 tests PASS; schema 55 fails on the full 3,250,033-byte fixture, schema 56 plus fresh process retry state succeeds with exact readback and tail searches three times.
- Data safety: real data touched NO. Tests use synthetic sessions/PGlite and temporary log paths. Existing log fields retained; old/partial lines preserved. JSONL aggregation is serialized by the app-owned singleton; multi-process concurrent writers are not supported (the application owns a single-instance lock).
- Remaining risk: mtime+size is the existing source freshness contract, not a content hash; source changes preserving both may not be detected. Deferred failures remain visible in index status. App restart intentionally resets backoff so repaired versions recover immediately.
- Git: only phase-owned indexer/retry/logger/main wiring/tests plus this report/release note; diff checked before local checkpoint. Phase 2 checkpoint: 72f20bb8.

## Pending phases

4 real macOS bundle; 5 search semantic audit; 6 responsibility extraction; 7 incremental UI/IA; final regression.

## Phase 4 — AUTOMATED PASS / MANUAL_CHECK_REQUIRED

- Investigation: the wrapper launches the npm Electron binary; the dependency's Info.plist names both bundle and executable Electron. app.setName alone does not replace native bundle identity.
- Changes: local-only packaging generator copies (never patches) the runtime, built app and installed dependency tree into mkdtemp; renames executable, sets product identity and distinct review bundle ID, reuses icon generator, ad-hoc signs and verifies the copy. A sibling CLI invokes the same executable. See [local review bundle guide](macos-review-bundle.md). No installation/update integration changed.
- Tests: `npm run build` PASS, with pre-existing unresolved Source Serif 4 font warning (installed dependency missing) and no browser-externalization warning. `node --test scripts/package-local-macos.test.mjs scripts/install-macos-app.test.mjs` 9/9 PASS with isolated HOME and no inherited AGENT_RECALL_TEST_HOME override. First attempt with that override produced two test-fixture path failures; removing only that conflicting environment variable resolves them, not a product fix.
- `node scripts/package-local-macos.mjs`: PASS, real bundle generated, ad-hoc signature verified. `node scripts/smoke-local-macos.mjs <temporary-app>`: PASS; real packaged AgentRecall executable, expected bundle/name/icon, renderer content, isolated paths, exit 0, PostgreSQL stopped. Initial smoke harness needed startup-context delay and failed with nested seatbelt sandboxes; final test disables only Chromium's nested sandbox while retaining the outer real-home deny/loopback-only sandbox. Failed test processes and temporary PostgreSQL were stopped explicitly; no installed app or real data touched.
- Remaining: MANUAL DOCK LABEL CHECK REQUIRED; Finder double-click and icon appearance also manual. No claim of notarization/Gatekeeper/production packaging acceptance. Offline local bundle includes dev dependencies. Native runtime helpers retain Electron helper naming; the main app identity is AgentRecall. Team approval required for production dependency pruning/update design.
- Data safety: real DB/data read or written NO; installed app replaced NO; dependency bundle modified NO; credentials used NO. Git: Phase 3 checkpoint d884898e; only packaging/icon export/scripts/package command and local documentation changed in Phase 4.

## Remote freeze

Remote branches created: NO
Remote pushes performed: NO
Pull Requests created/updated: NO
Issues created/updated: NO
Releases published: NO
Packages published: NO

Team discussion and any later publication: AWAITING_TEAM_APPROVAL.
