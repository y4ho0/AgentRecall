# Workbench overview stability and daily history

Local-only follow-up. READY_FOR_TEAM_REVIEW. Final native verification: PASS.

- Overview cards stretch to equal height when sharing a row. Usage and quota feedback reserve a 32px bottom area inside existing padding; transient messages do not affect layout and have no full-width background. Existing quota details remain visible during a manual refresh.
- Usage metrics have 18px top/bottom padding and a divider below the controls. Token composition has 16px top / 12px bottom padding, and its cache explanation wraps without truncation.
- Trend cards have a 280px minimum height, increasing to 320px when the responsive grid puts the chart on another row. Plot space has a 140px minimum independently of labels and summary.
- The V2 workbench requests a bounded 90-day daily history and offers 7/30/90-day views. Date labels become sparse for longer windows, and daily markers appear on hover/focus (plus Today) rather than crowding the line; daily tooltips and date navigation remain available. Summary period and origin semantics are unchanged. Daily events are bucketed in a single pass.
- The selected trend range is saved as a V2 renderer preference, so leaving and returning to Workbench or reopening the app retains it. Only 7/30/90 are accepted; missing/invalid/unreadable preferences default to 7. If profile storage refuses writes, the selection still works for the current mount but cannot be retained. This changes only the V2 Workbench display preference, not session statistics, sources or V1.
- No schema migration or session-transcript mutation. Other V2 callers retain the default seven daily buckets. V1 was inspected and has a separate statistics contract without this Workbench daily-history field; its behavior is unchanged.

## Verification

- Focused repository and Workbench tests: 22 PASS. App wiring, catalog service and IPC tests: 29 PASS. Following the final single-pass aggregation change, deduplication and longer-history regression cases: 2 PASS. Final quota-content/chart component cases: 3 PASS.
- Final typecheck, source-entrypoint check and existing local macOS package build: PASS. Existing Source Serif asset warning remains.
- Final packaged native smoke: PASS (exit 0; isolated PostgreSQL stopped). Native checks cover refresh dimensions at 1728, 1000 and 860px widths, feedback padding/background, real 7/30/90-day windows, sparse ticks and markers, minimum plot height, long cache captions, existing bilingual/zoom layouts, and synthetic records from today, 14 days ago and 60 days ago. Saved 84 UI screenshots plus two base smoke screenshots; manually inspected representative wide and stacked trend captures, not every screenshot.
- Both refresh actions preserved all three cards' width/height/position. Same-row cards measured 280px high at 1728px; stacked trend cards measured 320px high with approximately 197px plot height. Feedback had transparent background, 12px bottom inset and no horizontal overflow.
- Range-persistence follow-up: the new remount regression failed before the fix (30 reverted to 7), then all 6 chart/Workbench component cases passed, including malformed/unsupported preferences and unavailable storage. Final package typecheck/build and isolated native regression passed. Nine real Workbench → Session → Workbench round trips (7/30/90 days at three widths) retained both the selected range and corresponding daily points/totals. No separate process-restart scenario was run.
- Latest native report/screenshots: `/private/var/folders/9y/2y32pc6d6f50h766fbn___dm0000gp/T/agent-recall-local-app-nHxVwc/ui-quality-result.json`. Build log: `/tmp/agent-recall-trend-persistence-build.log`. Smoke log: `/tmp/agent-recall-trend-persistence-smoke.log`.
- Full repository suite was not repeated for this scoped follow-up. Actual user data, authenticated quotas/providers and multi-monitor behavior were not exercised.
- Earlier harness attempts exposed subpixel rounding at a 12px inset and a Provider fixture update racing page state. Geometry now permits subpixel tolerance; the fixture waits for its actual loaded path instead of a fixed sleep.

All tests use isolated temporary data. Installed apps, true user databases, global configuration and dependency Electron.app remain untouched. Remote operations: NONE. Publication: AWAITING_TEAM_APPROVAL.

## Manual app handoff

- Verified candidate was built/tested in `agent-recall-local-app-nHxVwc`, then moved to the retained manual-test path: `/private/var/folders/9y/2y32pc6d6f50h766fbn___dm0000gp/T/agent-recall-local-app-5iuLg4/AgentRecall.app`. Its isolated Finder launch environment was copied from the retained manual-test bundle; the final plist is byte-identical to the old one and local ad-hoc signing verified.
- Previous bundle preserved at `/private/var/folders/9y/2y32pc6d6f50h766fbn___dm0000gp/T/agent-recall-local-app-5iuLg4/previous-build-INyz2C/AgentRecall.app`.
- The previous instance (PID 72890) exited through its Quit menu, and its exit was confirmed before replacement. No force termination was needed. The replaced manual app was not relaunched automatically. Manual test data was not inspected or modified by tools.
