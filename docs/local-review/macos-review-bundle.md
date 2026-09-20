# Local macOS review bundle

This is an offline developer-review tool, not a replacement for the npm install/update flow. It neither installs into Applications nor changes LaunchServices registration. Never use real application data for unattended checks.

From `apps/main-2.0`, run `npm run package:local:macos`. The tool builds the application, copies the existing Electron runtime and installed dependencies into a fresh OS temporary directory, sets the app identity/icon, and ad-hoc signs the copy without credentials. The original Electron dependency is unchanged. No network dependency resolution is performed. Build dependencies must already be installed.

The printed result identifies `AgentRecall.app` and a sibling `agent-recall-v2-local` command. Both run the same real app executable. The package/product name stays `agent-recall-v2` to retain the existing default data-directory contract; the local-review bundle identifier is intentionally distinct. Do not open it without explicit isolated paths until the team authorizes real-data acceptance.

Run `node scripts/smoke-local-macos.mjs <printed-appPath>` for safe automated startup/shutdown. The runner only accepts this tool's temporary output location. It creates temporary HOME, appData, userData, agent configuration, and shell configuration; blocks the real home directory and non-loopback network at the OS sandbox boundary; uses a mock keychain; and disables update checks. Chromium's nested sandbox is disabled only in this test invocation because seatbelt sandboxes cannot nest. The outer sandbox remains active for all descendants. It verifies actual executable, package identity, populated renderer, bundle metadata/icon, graceful exit, and temporary PostgreSQL shutdown. Temporary smoke data is removed afterward.

Review limitations:

- This intentionally retains installed development dependencies for offline review. It is not a size-optimized or notarized distribution. A production dependency-closure and update strategy requires team agreement.
- The npm CLI/launcher remains supported independently; no installed launcher's target is changed.
- Finder double-click, actual Dock label/icon appearance, Gatekeeper/quarantine behavior, and update/uninstall integration require manual acceptance. Automated metadata/startup checks do not prove these.
- Do not publish or upload the generated bundle. Remove only the exact generated temporary directory after review.
