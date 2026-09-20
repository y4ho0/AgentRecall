# V2 UI quality pass

Baseline: ab5d24b8. LOCAL ONLY. Status: READY_FOR_TEAM_REVIEW.

## Audit and scope

Inspected renderer TSX/CSS, existing tests, typography/spacing/motion tokens and native window sizing before editing. V1 has the same legacy 10px Session section caption, but this authorized desktop-quality iteration targets V2 only; no session semantics or V1 persistence change.

| Surface | Finding and bounded response |
| --- | --- |
| Workbench | Usage follows all tasks; overview columns impose 390+330+230px minima. Restore compact overview first; normalize three column weights and reflow by available container width. Preserve custom task order. |
| Session | 12px panel / 10px group / 12.5px child hierarchy inversion; 24px parent hit area; instant unmount; wrapping tags; fixed filter widths plus horizontal scrolling. Adjust hierarchy, disclosure, metadata and toolbar grouping. |
| Chat | Fixed 208px/184px secondary panes already have responsive treatment; header actions lack wrap and connection text lacks shrink allowance. Scope fixes to these boundaries. |
| Runtime | Sidebar and summary have existing 900/760 breakpoints and minmax(0,1fr); small 9px metadata and short control labels need targeted normalization. |
| Workflow | Intentional graph/canvas scrolling differs from accidental toolbar overflow; inspector and planning panes have reflow rules. Preserve the graph/state machine; audit small labels and action controls only. |
| Eval | Tabs lack wrapping policy; preserve single-line buttons and wrap the group. No evaluation data/logic changes. |
| Memory | Paths largely have min-width/ellipsis; page actions need grouping on narrow widths. Small metadata remains a targeted readability concern. Do not enable/install OpenViking for QA. |
| Skills | Actions already nowrap, but toolbar/tabs do not reflow; count badges 9px. Wrap groups and reuse metadata token. |
| MCP | minmax columns already used; group headings are 9px and compact controls need clear boundaries. No gateway/tool changes. |
| Provider | Body capped at 980px while viewport grows; configuration path ellipsis lacks full-value title. Use bounded 1440px content, proportional label/value fields, existing responsive grids, and full-path hints. |
| Settings | Focus ring already defined; dialog actions need wrapping as a group. Existing draggable-region exclusion protects overlays. No settings schema changes. |

Typography inventory (pre-normalization fixed px declarations, not claims about every computed visible element): base 9–15, app shell 10–16, Workbench 9–13, Session 9–14, Provider 10.5–12.5, Chat 8–17, Runtime/Workflow/MCP owning automation CSS 8–18, Eval 10–13, Memory 8.5–17, Skills 8.5–18, Settings 10–22. Existing semantic scale: 11/12/13/14/16/20px; spacing: 4/8/12/16/20/24px. Avoid global font-size increments and graph-coordinate changes. Muted/faint text colors are theme variables; selected states already use accent background and weight; global focus-visible outline is retained.

Planned owning files: renderer styles.css; styles/{app-shell,sessions,workbench,providers,skills-page,team-chat,eval,settings,automation,openviking-memory}.css; SessionsPage/SessionRow, WorkbenchPage, ProviderPage; their component tests; existing local smoke harness and review documentation. No database/indexer/search/launcher/packager redesign.

## Design decisions

- Session panel heading 14px/600; parents 13px/600, ordinary children 12px/400, selected children 12px/600. Parent height 30px, child rows 28px, parent-child gap 4px, section gap 12px, indentation 12px. Hierarchy does not depend on color.
- Session pane clamp(210px,19vw,280px), compact minimum 210px. Native default remains 1280x820, minimum 860x560 until actual geometry verification warrants a change.
- Disclosure uses 170ms enter / 130ms exit, grid track expansion plus opacity and chevron rotation. Collapsed descendants become inert/aria-hidden immediately; no delayed state timers. Reduced motion disables transitions immediately.
- Workbench overview weights: previous 1.24/1.04/.78 multiplied by .85/1.25/1.25 then normalized within the existing container. Literal simultaneous -15%/+25% widths cannot fit unchanged total width; relative emphasis and no overflow take priority. Responsive two/one-column reflow is container based.
- Test data must be synthetic, all native app paths explicit, with kernel sandbox denial of the real home and non-loopback network. Retain final review app, never overwrite the earlier review app or installed app.

## Changes and responsive behavior

- Workbench: overview precedes task cards; three proportional columns reflow to two/one columns at container widths 900/760px. Custom task-card order is preserved. Usage legend items wrap as complete units.
- Session: clearer heading/group/child typography, full-width parent controls, aligned rotating chevrons, consistent 28px child rows, immediate collapsed accessibility state, and responsive grouped filters below Search. Source/view selections expose `aria-pressed`.
- Session metadata: bounded tag column, single-line ellipsis and full-value titles; short `main`, long branch names, and very long unbroken strings are covered. Session titles also expose full text. Long tags do not increase a row's height.
- Provider: aligned header/tabs/body/footer, bounded 1440px configuration area, proportional fields and complete path titles. Action groups may wrap; individual short controls do not.
- Shared UI: system-first font stack, reuse of existing semantic type/spacing tokens, selected small metadata raised to 11px, targeted no-wrap controls and group wrapping on Chat, Eval, Memory, Skills and Settings. New motion uses shared tokens; reduced motion disables transitions.
- No new dependency, database migration, indexer/search behavior, launcher or packaging algorithm change. Native window defaults stay 1280x820, minimum 860x560; the tested layouts did not justify changing them.

| Content viewport | Session sidebar | Provider form |
| --- | ---: | ---: |
| 1280x800 | 243px | 1030px |
| 1440x900 | 274px | 1190px |
| 1728x1117 | 280px | 1440px |
| 2048x1286 | 280px | 1440px |
| 1000x800 | 210px | 866px |
| 860x800 | 210px | 726px |

All six sizes were checked in Chinese and English for Workbench, Session and Provider. Rounded widths above are measured, not independent fixed CSS widths. At 2048px, overview widths were approximately 563/694/521px after normalization. Expanded and compact Session panes retain the same 14/13/12px hierarchy; selected children stay 12px.

## Regression tests

Completed checks:

- Earlier full Vitest run: 272 files, 2626 tests passed, none failed or skipped.
- Final full Vitest rerun without concurrent native smoke: 272 files, 2626/2626 tests passed, zero failed/skipped, 110.42 seconds. The previously failing indexer backoff test passed in 1261ms; the >3MB Turn regression passed in 3699ms.
- Focused UI + existing PostgreSQL/indexer regressions: 82/82 passed. This includes the existing >3MB Turn preservation/reindex/tail-search regression, schema 55-to-56 upgrade and failure/backoff recovery. Persistence tests use synthetic stores, not the real user database.
- Final Provider/Session tooltip and accessibility tests: 11/11 passed.
- Script suite: 169/169 passed. Remote/publishing/install scenarios in that suite use fixtures/mocks; no remote publishing was performed.
- Typecheck, dead-code entrypoint check, build and existing macOS local package build: passed.
- An additional full run concurrent with native screenshot smoke returned 2625/2626: the unchanged indexer backoff/recovery test failed after about 5776ms. Its JSON reporter retained only `STACK_TRACE_ERROR`, insufficient to establish the cause. An isolated targeted rerun passed in 1266ms. No source, timeout or assertion was changed to conceal this failure. Both full-run reports are retained; the final full rerun is not concurrent with native smoke.
- Diff whitespace checks passed. Release-note validation must use this iteration's local baseline: `npm run release-note:check -- ab5d24b8 HEAD`. The default range against the pre-existing local `origin/main` also includes the earlier stage's release fragment and rejects two fragments; no fetch or remote operation is necessary or performed.

## Visual tests

Existing isolated native Electron smoke: PASS on the retained final app; 36 critical-page layout cases and 44 UI-quality screenshots. Other audited pages were opened in empty/disabled/template/built-in state at 1280x800, including the Settings modal. Assertions cover:

- No horizontal overflow on checked page/toolbar surfaces; short compact controls stay single-line.
- Search remains above secondary controls and at least 230px wide.
- Session heading/group/child computed sizes and weights, child-row heights and parent hit-area width.
- Short tag visibility; long tag ellipsis; no row-height change when replacing a long tag with `main`; main title keeps at least 60% of row width.
- Workbench overview precedes task cards; no card/legend overlap.
- Provider full-path titles and useful wide-screen form width.
- Disclosure height 171 -> 0 -> 171px; immediate inert state and parent focus; 170ms enter transition. Emulated reduced-motion computed transition is 0s.

Representative screenshots were inspected visually, including Chinese expanded Session, English compact Session, wide Provider and Workbench. Not every saved screenshot received individual visual inspection. Layout checks do not prove populated workflow behavior or operating-system integration. Native smoke exit code was 0 and its temporary PostgreSQL process stopped. The smoke uses explicit isolated directories, an outer sandbox denying the real home, and loopback-only networking.

## Remaining visual issues and manual checks required

- Pre-existing unresolved Source Serif 4 asset warning remains during build; system fallback is available. No dependency install/download was attempted.
- Some dense graph/telemetry detail text remains 8-9px. This pass normalizes selected standard labels rather than mechanically changing all graph geometry. Further readability review is appropriate; no critical/high-severity regression was identified in tested surfaces.
- MANUAL VISUAL CHECK: Finder double-click, Dock/menu identity, Gatekeeper behavior, physical-device reduced-motion setting, keyboard traversal and resize feel. Finder launch itself was not automated; automated smoke launches the executable with its own verified isolation.
- Review realistic larger synthetic lists, multiple tags, dialogs/overlays, all Provider tabs, populated Chat/Workflow/Runtime/Eval/Memory/Skills/MCP states, and dark theme if used. Empty-state layout inspection does not establish all these states.
- Use only synthetic data in the retained test app. Do not import real sessions, choose real credential/config directories, connect real databases, or enable real external providers for this acceptance pass.
- Windows and Intel macOS execution, notarization, production migration, release approval and team agreement: NOT PERFORMED. Team review/publication decision remains AWAITING_TEAM_APPROVAL.

## Local checkpoints

Branch: `ui/v2-quality-pass`; baseline `ab5d24b8`.

1. `53e86089` — compact controls, system typography and selected metadata readability.
2. `eefdf8f5` — Session hierarchy, disclosure, metadata/toolbar layout and component coverage.
3. `95e7535a` — Provider responsive configuration layout and path coverage.
4. `9d405dad` — Workbench overview order/proportions and native layout regression harness.
5. `docs: record local UI quality acceptance (local checkpoint)` — this report, aggregate verification record and release-note fragment. Resolve its hash with `git log -1 --format=%h -- docs/local-review/ui-quality-pass.md`; it does not alter the packaged runtime source.

## Retained manual-test app

App absolute path:

`/private/var/folders/9y/2y32pc6d6f50h766fbn___dm0000gp/T/agent-recall-local-app-5iuLg4/AgentRecall.app`

- CFBundleName / CFBundleDisplayName: `agent-recall-v2`
- CFBundleIdentifier: `dev.zszz3.agent-recall-v2.local-review`
- CFBundleExecutable: `AgentRecall` (arm64 Mach-O, not a bare Electron executable identity)
- Runtime source checkpoint: `9d405dad`; main/preload/renderer/icon present. Local ad-hoc signature verification passed after smoke.
- Manual isolation root: `/tmp/agent-recall-v2-ui-manual-TIUgTm`; `home`, `user-data`, `app-data`, `tmp` are separate subdirectories. Three explicitly synthetic Claude-format sessions exercise short/long/unbroken branches.
- Only this new generated bundle's `LSEnvironment` was configured and ad-hoc re-signed under the user's explicit permission. HOME, ZDOTDIR, AgentRecall home/userData/appData/temp, Codex and Claude configuration directories point into the manual root; database override is empty, mock keychain and no-update mode are enabled, PATH is limited to `/usr/bin:/bin`. Global shell configuration and the dependency Electron.app were not edited.
- Native automatic smoke uses a separate disposable test root, not the above retained manual root. The app and manual fixtures have not been deleted or installed to `/Applications`. This is temporary storage; preserve it elsewhere before OS temporary-directory cleanup if needed, keeping the isolation configuration intact.

## Commands and evidence

Commands run from `apps/main-2.0` unless indicated. Tests use the isolated HOME `/tmp/agent-recall-ui-quality-oG8vHD`, unset inherited `AGENT_RECALL_TEST_HOME`, disable Node experimental webstorage for the existing test suite, and keep npm offline.

```sh
env -u AGENT_RECALL_TEST_HOME HOME=/tmp/agent-recall-ui-quality-oG8vHD NODE_OPTIONS=--no-experimental-webstorage npm_config_offline=true npm exec -- vitest run --reporter=json --outputFile=/tmp/agent-recall-ui-quality-oG8vHD/full-vitest.json
env -u AGENT_RECALL_TEST_HOME HOME=/tmp/agent-recall-ui-quality-oG8vHD NODE_OPTIONS=--no-experimental-webstorage npm_config_offline=true npm exec -- vitest run src/renderer/src/features/sessions/sessions-page.test.tsx src/renderer/src/features/providers/provider-page.test.tsx src/renderer/src/features/workbench/workbench-page.test.tsx src/core/indexer.test.ts src/core/postgres/schema.test.ts src/core/postgres/session-search.test.ts
env -u AGENT_RECALL_TEST_HOME HOME=/tmp/agent-recall-ui-quality-oG8vHD NODE_OPTIONS=--no-experimental-webstorage npm_config_offline=true node --test --test-reporter=spec --test-reporter=junit --test-reporter-destination=stdout --test-reporter-destination=/tmp/agent-recall-ui-quality-oG8vHD/script-tests.xml scripts/*.test.mjs
env -u AGENT_RECALL_TEST_HOME HOME=/tmp/agent-recall-ui-quality-oG8vHD NODE_OPTIONS=--no-experimental-webstorage npm_config_offline=true npm exec -- vitest run src/core/indexer.test.ts -t 'keeps failures visible during backoff' --reporter=verbose
env -u AGENT_RECALL_TEST_HOME HOME=/tmp/agent-recall-ui-quality-oG8vHD NODE_OPTIONS=--no-experimental-webstorage npm_config_offline=true npm exec -- vitest run --reporter=default --reporter=json --outputFile.json=/tmp/agent-recall-ui-quality-oG8vHD/final-vitest-isolated.json
npm run typecheck
npm run build
npm run package:local:macos
node scripts/smoke-local-macos.mjs /private/var/folders/9y/2y32pc6d6f50h766fbn___dm0000gp/T/agent-recall-local-app-5iuLg4/AgentRecall.app --ui-quality
codesign --verify --deep --strict /private/var/folders/9y/2y32pc6d6f50h766fbn___dm0000gp/T/agent-recall-local-app-5iuLg4/AgentRecall.app
# Repository root:
git diff --check
git diff ab5d24b8..HEAD --check
npm run release-note:check -- ab5d24b8 HEAD
```

Full Vitest JSON reports and script JUnit XML are in `/tmp/agent-recall-ui-quality-oG8vHD`. `smoke-result.json`, `ui-quality-result.json` and the screenshot baseline are next to the retained app. These are local evidence, not uploaded artifacts. Build commands above identify the existing scripts used; they do not install the app.

## Integrity and publication boundary

Reviewed final source diff: renderer, component tests and opt-in native smoke QA only. No change under V2 `src/core`, `src/main`, `bin`, or `scripts/package-local-macos.mjs` relative to baseline. No schema migration is added by this UI iteration. Existing synthetic migration/search regressions exercise the inherited persistence baseline; they are not production-data acceptance.

Original dependency Electron.app Info.plist and executable hashes were unchanged after packaging/signing (SHA-256 `c1dac4f87e6f1fa273de3252024acacae88177dcbe83908d71d65d0528a3d67f`, `175d705949bf43e657dc6952ff4bd8ecd8e1902630a89da0b68df8a812309d72`).

- Real user DB touched: NO
- Installed AgentRecall overwritten: NO
- Remote branches created: NO
- Remote pushes performed: NO
- Pull Requests created/updated: NO
- Issues created/updated: NO
- Releases published: NO
- Packages published: NO

All changes, checkpoints, notes and test artifacts remain local. This report does not authorize publication; team review and agreement remain AWAITING_TEAM_APPROVAL.
