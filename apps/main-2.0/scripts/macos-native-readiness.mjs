import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

export async function waitForMacosAppReadiness(evaluate, electron) {
  // A painted renderer and live database do not imply that service startup has
  // settled. Exercise real preload IPCs before testing an ordinary ready-app quit.
  const renderer = `(${electron}.BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/renderer/index.html'))).webContents`;
  await evaluate(`${renderer}.executeJavaScript(${JSON.stringify(`
    globalThis.__agentRecallCoreReady = { state: 'loading' };
    Promise.all([
      window.sessionSearch.automation.listMcpServers(),
      window.sessionSearch.getLiveSessions(),
      window.sessionSearch.getStats(),
    ]).then(() => { globalThis.__agentRecallCoreReady = { state: 'ready' }; },
      error => { globalThis.__agentRecallCoreReady = { state: 'error', error: String(error) }; });
    undefined;
  `)})`);
  const readyDeadline = Date.now() + 60_000;
  let readiness;
  while (Date.now() < readyDeadline) {
    readiness = await evaluate(`${renderer}.executeJavaScript(${JSON.stringify(`(async () => ({
      ipc: globalThis.__agentRecallCoreReady,
      health: await window.sessionSearch.automation.getHealth(),
      index: await window.sessionSearch.getIndexStatus(),
    }))()`)} )`);
    assert.notEqual(readiness.ipc.state, "error", JSON.stringify(readiness.ipc));
    assert.notEqual(readiness.health.state, "error", JSON.stringify(readiness.health));
    if (readiness.ipc.state === "ready" && readiness.health.state === "ready"
      && !readiness.index.running && Number.isFinite(readiness.index.lastIndexedAt)) break;
    await delay(100);
  }
  assert.equal(readiness.ipc.state, "ready", "Core data IPCs did not become ready");
  assert.equal(readiness.health.state, "ready", "Automation startup did not settle");
  assert.equal(readiness.index.running, false);
  assert.ok(Number.isFinite(readiness.index.lastIndexedAt), "Initial indexing did not settle");
  assert.equal(readiness.index.error, null);
  return readiness;
}
