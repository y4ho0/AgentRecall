#!/usr/bin/env node
// Local review bundle, not a distributable release or an install/update path.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { generateIcnsFile } from "../bin/install-macos-app.cjs";
import { restoreEmbeddedPostgresNativeLinks } from "../bin/staged-package-dependencies.cjs";

const sourceRoot = path.resolve(fileURLToPath(import.meta.url), "../..");

export async function packageLocalMacosApp(packageRoot = sourceRoot) {
  if (process.platform !== "darwin") throw new Error("Local macOS packaging requires macOS.");
  packageRoot = await fs.realpath(packageRoot);
  for (const file of ["package.json", "out/main/index.js", "out/preload/index.mjs", "out/renderer/index.html", "out/mcp/skill-entry.js", "assets/app-icon.png"]) {
    await fs.access(path.join(packageRoot, file));
  }
  const runtime = path.join(packageRoot, "node_modules/electron/dist/Electron.app");
  await fs.access(path.join(runtime, "Contents/MacOS/Electron"));
  const manifest = JSON.parse(await fs.readFile(path.join(packageRoot, "package.json"), "utf8"));
  // mkdtemp is the only output destination: never overwrite an installed app,
  // dependency bundle, existing review bundle, or caller-selected directory.
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-recall-local-app-"));
  const appPath = path.join(outputRoot, "AgentRecall.app");
  try {
    await fs.cp(runtime, appPath, { recursive: true, verbatimSymlinks: true });
    const contents = path.join(appPath, "Contents");
    const resources = path.join(contents, "Resources");
    const appRoot = path.join(resources, "app");
    await fs.mkdir(appRoot);
    for (const entry of ["out", "bin", "assets", "THIRD_PARTY_NOTICES.md"]) {
      await fs.cp(path.join(packageRoot, entry), path.join(appRoot, entry), { recursive: true, verbatimSymlinks: true });
    }
    // Preserve the package name/default userData compatibility. This deliberately
    // copies the installed dependency tree for OFFLINE local review, including
    // dev dependencies; release pruning/notarization is a separate team decision.
    await fs.writeFile(path.join(appRoot, "package.json"), JSON.stringify(manifest, null, 2));
    await fs.cp(path.join(packageRoot, "node_modules"), path.join(appRoot, "node_modules"), {
      recursive: true, verbatimSymlinks: true,
      filter: (source) => !["electron", ".bin"].includes(path.relative(path.join(packageRoot, "node_modules"), source)),
    });
    await restoreEmbeddedPostgresNativeLinks(path.join(appRoot, "node_modules"));
    const executable = path.join(contents, "MacOS", "AgentRecall");
    await fs.rename(path.join(contents, "MacOS", "Electron"), executable);
    const plist = path.join(contents, "Info.plist");
    for (const [key, value] of Object.entries({
      CFBundleName: "agent-recall-v2", CFBundleDisplayName: "agent-recall-v2",
      CFBundleIdentifier: "dev.zszz3.agent-recall-v2.local-review",
      CFBundleExecutable: "AgentRecall", CFBundleIconFile: "AppIcon.icns",
      CFBundleVersion: manifest.version, CFBundleShortVersionString: manifest.version,
    })) execFileSync("/usr/bin/plutil", ["-replace", key, "-string", value, plist]);
    execFileSync("/usr/bin/plutil", ["-remove", "ElectronAsarIntegrity", plist]);
    await fs.rm(path.join(resources, "default_app.asar"));
    const icon = generateIcnsFile(path.join(packageRoot, "assets/app-icon.png"), outputRoot);
    if (!icon) throw new Error("Could not generate the local app icon.");
    await fs.copyFile(icon, path.join(resources, "AppIcon.icns"));
    // Ad-hoc only: no identity, keychain, Developer account or notarization.
    execFileSync("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "pipe" });
    execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", appPath], { stdio: "pipe" });
    const cliPath = path.join(outputRoot, "agent-recall-v2-local");
    await fs.writeFile(cliPath, '#!/bin/sh\nexec "$(dirname "$0")/AgentRecall.app/Contents/MacOS/AgentRecall" "$@"\n', { mode: 0o755 });
    return { outputRoot, appPath, executable, cliPath };
  } catch (error) {
    // Only the mkdtemp directory allocated by this invocation is removed.
    await fs.rm(outputRoot, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await packageLocalMacosApp(), null, 2));
}
