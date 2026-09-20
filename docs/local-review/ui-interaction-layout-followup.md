# UI interaction and layout follow-up

LOCAL ONLY — READY_FOR_TEAM_REVIEW. Baseline: `606b901e`.

## Scope and decisions

- Refresh feedback now participates in card layout, with 12px separation and 8px/10px internal padding, rather than sitting absolutely against the bottom edge. Workbench entry counts are 11px and descriptions 12px.
- All ten page headings share 24px top / 28px left padding, 20px titles, 12px descriptions and a 6px title-to-description gap. Removed Eval/Memory's double outer padding and Provider's independent centered heading. MCP's separate capability-registry heading was found by the cross-page test and replaced with the shared page heading.
- Runtime, Workflow and Skills use a small shared pointer/keyboard splitter. Arrow keys move 16px; Home/End select bounds; double click resets; localStorage remembers the preferred width. Available space clamps the effective width without discarding that preference. Very narrow layouts stack rather than squeeze the detail pane. Session's existing detail splitter is unchanged.
- Runtime details and Provider forms are centered with a 1120px maximum. Runtime summary actions reflow according to the editor container's width, including when a user widens the sidebar without resizing the window. Balance guidance wraps instead of clipping.
- Provider preset cards were further adjusted following live user feedback: 200–248px tracks (shrinking only below 200px available space), minimum 64px height, 12px vertical / 16px horizontal padding, 4px label gap, 13px name / 12px explanation. Columns reduce automatically.
- Model-probe errors span the full form row and wrap long unbroken text. Settings, Skills, Memory and global feedback also have long-text safeguards. The main settings dialog radius is 18px. Its sidebar scrolls independently when feedback reduces available height; tall feedback starts at the top rather than clipping centered text.
- No provider, execution, indexing, persistence or migration behavior changed. Width preferences are the only new persisted values. No schema migration required.

## Automated evidence

- Full Vitest regression: 273 files / 2633 tests PASS. Script tests: 169 PASS.
- Environment: current Node 25 exposes an incompatible native localStorage in happy-dom without a file. The first full run failed existing storage-dependent tests. Re-running with per-command `NODE_OPTIONS=--no-experimental-webstorage` passed; no global Node or shell configuration changed. The new splitter tests use their own in-memory storage mock.
- After the MCP header change: focused MCP, splitter and Provider tests, 18/18 PASS. Splitter tests cover keyboard bounds, saved width, resize clamping, stacking and pointer cleanup on pointerup/cancel/blur/unmount. Provider test covers pending probe disablement and complete long error rendering.
- Typecheck, production source-entrypoint check and local package build PASS. Existing Source Serif 4 asset warning remains.
- Native harness extends the earlier 36 Chinese/English critical-page cases and 12 Workbench zoom cases with all-page heading coordinates, actual refresh feedback, native pointer/keyboard splitter interactions, remount persistence, Runtime balance/action bounds, real local probe validation failure plus a clearly synthetic unbroken-error CSS fixture, settings error padding, and zoomed stacked layouts.
- The first all-page comparison exposed MCP's separate header. A subsequent native run passed numerical geometry but screenshot inspection found settings sidebar/footer overlap and clipped initial error lines. Both were corrected and assertions added for feedback text start and sidebar bounds. This is why snapshot inspection supplements, not merely repeats, automated geometry checks.
- Tests use synthetic sessions and a fresh HOME/userData with an OS sandbox denying the real HOME and non-loopback network. They do not use the manual tester's temporary data or actual accounts. Missing external Node/MCP availability under that deliberately restricted PATH is not a production integration verdict.
- Final native smoke PASS: exit 0, PostgreSQL stopped; 36 bilingual critical-page cases, 12 numeric zoom cases, 30 page-header comparisons, 9 pointer/keyboard/remount split checks, 3 zoomed stacking checks, refresh/error states and 75 screenshots. Inspected representative Chinese Provider/Workbench, narrow Runtime, long Provider errors, zoomed Skills and settings long-error screenshots. Header geometry matched at x=28/y=24, title=20px/description=12px/gap=6px across all 30 comparisons.

## Retained app and results

Updated test App (same user-approved path):
`/private/var/folders/9y/2y32pc6d6f50h766fbn___dm0000gp/T/agent-recall-local-app-5iuLg4/AgentRecall.app`

Old bundle was normally quit, its main process disappearance verified, and moved to recoverable backup:
`/private/var/folders/9y/2y32pc6d6f50h766fbn___dm0000gp/T/agent-recall-local-app-5iuLg4/previous-build-1Z1cyP/AgentRecall.app`

Latest native JSON, layout measurements and screenshots:
`/private/var/folders/9y/2y32pc6d6f50h766fbn___dm0000gp/T/agent-recall-local-app-ZZF7KR`

The smoke report's executable path is the staging location; the tested bundle was moved intact to the retained path. Final signature verification and exact comparison of old/new `LSEnvironment` passed. Manual userData remains `/tmp/agent-recall-v2-ui-manual-TIUgTm/user-data`; no manual data/config was reset. No installed app, true user database, global environment, or dependency Electron bundle was modified.

Full regression output: `/tmp/agent-recall-ui-interaction-tests-node-isolated.log`.

## Reproduction commands

Run from `apps/main-2.0`:

```sh
env -u AGENT_RECALL_TEST_HOME HOME=/tmp/agent-recall-ui-quality-oG8vHD NODE_OPTIONS=--no-experimental-webstorage npm_config_offline=true npm test
env -u AGENT_RECALL_TEST_HOME HOME=/tmp/agent-recall-ui-quality-oG8vHD NODE_OPTIONS=--no-experimental-webstorage npm_config_offline=true npm run package:local:macos
node scripts/smoke-local-macos.mjs <generated-temporary-app-path> --ui-quality
```

Only the generated bundle receives the retained manual app's isolated `LSEnvironment`, followed by local ad-hoc signing and signature verification. The dependency Electron.app is never edited.

## Remaining manual acceptance

- Visual preference for card proportions, subtitle readability and settings curvature at the user's display scale.
- Real authenticated quota/provider responses, multi-monitor drag behavior, and VoiceOver interaction are NOT PERFORMED.
- Synthetic long-text geometry is not a claim that every possible remote error or every populated workflow/skill state has been validated.
- All changes remain local; publication is AWAITING_TEAM_APPROVAL.

Remote branches created: NO
Remote pushes performed: NO
Pull Requests created/updated: NO
Issues created/updated: NO
Releases published: NO
Packages published: NO
