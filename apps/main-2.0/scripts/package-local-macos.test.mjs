import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { packageLocalMacosApp } from "./package-local-macos.mjs";

test("local bundle rejects incomplete build input without modifying it", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-recall-package-input-"));
  try {
    await fs.writeFile(path.join(root, "package.json"), '{"name":"fixture"}');
    await assert.rejects(packageLocalMacosApp(root), process.platform === "darwin" ? /ENOENT/ : /requires macOS/);
    assert.deepEqual(await fs.readdir(root), ["package.json"]);
    assert.equal(await fs.readFile(path.join(root, "package.json"), "utf8"), '{"name":"fixture"}');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
