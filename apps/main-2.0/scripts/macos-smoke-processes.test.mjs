import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cleanupSmokeProcessGroup, waitForSmokeProcessGroupExit } from "./macos-smoke-processes.mjs";

const posix = { skip: process.platform === "win32", timeout: 10_000 };
async function orphanHelpers(t, stubborn = false) {
  const helper = `
    ${stubborn ? 'process.on("SIGTERM", () => {});' : ''}
    setInterval(() => {}, 1000);
    process.send(process.pid);
  `;
  const parent = spawn(process.execPath, ["-e", `
    const { spawn } = require('node:child_process');
    let ready = 0;
    for (let i = 0; i < 3; i++) {
      const child = spawn(process.execPath, ['-e', ${JSON.stringify(helper)}], {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      });
      child.once('message', pid => {
        console.log(pid);
        if (++ready === 3) process.exit(0);
      });
    }
  `], { detached: true, stdio: ["ignore", "pipe", "inherit"] });
  t.after(async () => { await cleanupSmokeProcessGroup(parent.pid); });
  let output = "";
  parent.stdout.on("data", data => { output += data; });
  const [code] = await once(parent, "exit");
  assert.equal(code, 0);
  const pids = output.trim().split("\n").map(Number);
  assert.equal(pids.length, 3);
  for (const pid of pids) process.kill(pid, 0);
  return { parent, pids };
}

test("cleans all surviving helpers after the parent has already exited", posix, async t => {
  const { parent, pids } = await orphanHelpers(t);
  assert.equal(await waitForSmokeProcessGroupExit(parent.pid, 0), false);
  const result = await cleanupSmokeProcessGroup(parent.pid);
  assert.deepEqual(result, { confirmed: true, signals: ["SIGTERM"] });
  for (const pid of pids) assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
  assert.equal(await waitForSmokeProcessGroupExit(parent.pid, 0), true);
});

test("failure recovery escalates only for helpers that ignore TERM", posix, async t => {
  const { parent, pids } = await orphanHelpers(t, true);
  assert.deepEqual(await cleanupSmokeProcessGroup(parent.pid, 200), {
    confirmed: true, signals: ["SIGTERM", "SIGKILL"],
  });
  for (const pid of pids) assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
});

test("natural success needs no termination signal and does not touch another group", posix, async t => {
  const sentinel = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: true, stdio: "ignore" });
  t.after(async () => { await cleanupSmokeProcessGroup(sentinel.pid); });
  const child = spawn(process.execPath, ["-e", "process.exit(0)"], { detached: true, stdio: "ignore" });
  t.after(async () => { await cleanupSmokeProcessGroup(child.pid); });
  await once(child, "exit");
  assert.equal(await waitForSmokeProcessGroupExit(child.pid), true);
  assert.deepEqual(await cleanupSmokeProcessGroup(child.pid), { confirmed: true, signals: [] });
  process.kill(sentinel.pid, 0);
});

test("unconfirmed group exit throws and retains fixtures", async t => {
  const signals = [];
  t.mock.method(process, "kill", (_pid, signal) => { signals.push(signal); return true; });
  await assert.rejects(cleanupSmokeProcessGroup(987654, 0), /did not exit; fixtures retained/);
  assert.ok(signals.includes("SIGTERM"));
  assert.ok(signals.includes("SIGKILL"));
});

test("rejects unsafe group identifiers and does not swallow permission errors", async t => {
  for (const pid of [undefined, 0, 1, -42, process.pid]) {
    await assert.rejects(cleanupSmokeProcessGroup(pid), /Invalid owned smoke process group/);
  }
  t.mock.method(process, "kill", () => { throw Object.assign(Error("denied"), { code: "EPERM" }); });
  await assert.rejects(cleanupSmokeProcessGroup(987654), { code: "EPERM" });
});
