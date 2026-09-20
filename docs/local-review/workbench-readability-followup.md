# Workbench readability follow-up

LOCAL ONLY — READY_FOR_TEAM_REVIEW. Follow-up to the screenshot feedback after the UI quality baseline `89a819de`.

## Changes

- Four equal-width metrics use the same centered alignment, with 16px separation from the header controls.
- Numbers scale with their own metric column using container-relative units, bounded at 16–26px, instead of scaling with the whole window.
- Model quotas use two compact provider rows: 32px identity badges, 13px names, 12px status/actions, top-aligned content, readable reset line-height and fully wrapping unavailable-state guidance. No quota-fetching behavior changed.
- Trend chart has an explicit date-label row, more plot/label separation, and 12px margin plus 8px padding before the summary text.

## Verification

- Workbench component tests: 2/2 PASS; typecheck, source entrypoint check and package build PASS.
- Existing isolated native smoke: PASS, exit 0, PostgreSQL stopped. Six viewport sizes in Chinese/English: 36 critical-page layout cases. Additional Workbench zoom checks: 1120/1280/1728px windows at 80/100/125/150 percent, 12 cases. 56 screenshots retained; representative normal/zoomed views inspected visually.
- Synthetic rendered numeric labels include `999.9K`, `99.9K`, `999.9M`, `98.1%`. Assertions measure actual text bounds: no clipping. In zoom cases, computed numeric sizes ranged from about 17.1 to 26px, and the smallest date-to-summary gap was about 20.7px.
- The first zoom run exposed strict pixel-equality in the new test (32px icon measured 31.992px). Changed only that geometry assertion to allow 0.5px subpixel rounding; the complete rerun passed. No production layout relaxation was needed.
- Live authenticated quota values and real provider accounts were not exercised. Quota screenshots cover unavailable states. Full repository/persistence suites were not repeated for this presentation-only follow-up; prior baseline results are separate evidence, not a new full-suite claim.
- Existing Source Serif 4 asset build warning remains unchanged.

## Retained app and evidence

Updated app at the user-approved existing test path:
`/private/var/folders/9y/2y32pc6d6f50h766fbn___dm0000gp/T/agent-recall-local-app-5iuLg4/AgentRecall.app`

Its previous bundle is recoverable under `previous-build-cwYGVD/AgentRecall.app` in the same parent directory. The app was normally quit before replacement; the new bundle's ad-hoc signature was verified. The existing isolated `LSEnvironment` and `/tmp/agent-recall-v2-ui-manual-TIUgTm/user-data` configuration were preserved; no manual data was migrated or reset.

Latest automatic smoke JSON, geometry and screenshots are in:
`/private/var/folders/9y/2y32pc6d6f50h766fbn___dm0000gp/T/agent-recall-local-app-KxgZyb`

That report records the staging executable path used during verification; the tested bundle was then moved intact to the retained app path above. Earlier screenshots/reports under the retained path describe earlier builds.

No installed app, real user database, global configuration or dependency Electron.app was changed. No remote branches, pushes, PRs, Issues, releases, packages or artifact uploads. Publication remains AWAITING_TEAM_APPROVAL.
