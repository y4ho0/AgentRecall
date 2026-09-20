import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import type { SessionIndexFailureDiagnostic } from "../core/indexer";
import { createSessionIndexFailureLogger } from "./session-index-failure-log";

function diagnostic(sessionKey: string): SessionIndexFailureDiagnostic {
  return {
    source: "codex-cli",
    sessionKey,
    filePath: `/tmp/${sessionKey}.jsonl`,
    error: {
      name: "Error",
      message: `Could not index ${sessionKey}`,
      stack: `Error: Could not index ${sessionKey}\n    at test`,
    },
  };
}

describe("session index failure log", () => {
  it("writes only the approved diagnostic fields to a user-only JSONL file", async () => {
    const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "agent-recall-index-log-"));
    try {
      const logger = createSessionIndexFailureLogger(userDataPath, {
        now: () => new Date("2026-07-30T12:00:00.000Z"),
      });

      await logger.write({
        ...diagnostic("codex:one"),
        messages: [{ role: "user", content: "must not be logged" }],
      } as SessionIndexFailureDiagnostic);

      expect(logger.logPath).toBe(path.join(userDataPath, "logs", "session-index-failures.jsonl"));
      const record = JSON.parse(fs.readFileSync(logger.logPath, "utf8").trim()) as Record<string, unknown>;
      expect(record).toEqual({
        timestamp: "2026-07-30T12:00:00.000Z",
        fingerprint: expect.any(String),
        count: 1,
        firstSeen: "2026-07-30T12:00:00.000Z",
        lastSeen: "2026-07-30T12:00:00.000Z",
        source: "codex-cli",
        sessionKey: "codex:one",
        filePath: "/tmp/codex:one.jsonl",
        error: {
          name: "Error",
          message: "Could not index codex:one",
          stack: "Error: Could not index codex:one\n    at test",
        },
      });
      expect(record).not.toHaveProperty("messages");
      if (process.platform !== "win32") {
        expect(fs.statSync(path.dirname(logger.logPath)).mode & 0o777).toBe(0o700);
        expect(fs.statSync(logger.logPath).mode & 0o777).toBe(0o600);
      }
    } finally {
      fs.rmSync(userDataPath, { recursive: true, force: true });
    }
  });

  it("aggregates concurrent repeated failures across logger restarts without losing firstSeen", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-recall-index-log-"));
    try {
      let now = new Date("2026-09-20T00:00:00Z");
      const entry = { ...diagnostic("codex:one"), revision: { fileMtimeMs: 1, fileSize: 10 } };
      let logger = createSessionIndexFailureLogger(root, { now: () => now });
      await logger.write(entry);
      now = new Date("2026-09-20T00:01:00Z");
      logger = createSessionIndexFailureLogger(root, { now: () => now });
      await Promise.all(Array.from({ length: 20 }, () => logger.write(entry)));
      const records = fs.readFileSync(logger.logPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({ count: 21, firstSeen: "2026-09-20T00:00:00.000Z", lastSeen: "2026-09-20T00:01:00.000Z" });
      await logger.write({ ...entry, revision: { fileMtimeMs: 2, fileSize: 10 } });
      await logger.write({ ...entry, sessionKey: "codex:two" });
      expect(fs.readFileSync(logger.logPath, "utf8").trim().split("\n")).toHaveLength(3);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps only the current log and one rotated log", async () => {
    const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "agent-recall-index-log-"));
    try {
      const logger = createSessionIndexFailureLogger(userDataPath, { maxBytes: 1 });

      await logger.write(diagnostic("codex:one"));
      await logger.write(diagnostic("codex:two"));
      await logger.write(diagnostic("codex:three"));

      const previousPath = path.join(userDataPath, "logs", "session-index-failures.previous.jsonl");
      expect(JSON.parse(fs.readFileSync(previousPath, "utf8")).sessionKey).toBe("codex:two");
      expect(JSON.parse(fs.readFileSync(logger.logPath, "utf8")).sessionKey).toBe("codex:three");
      expect(fs.readdirSync(path.dirname(logger.logPath)).sort()).toEqual([
        "session-index-failures.jsonl",
        "session-index-failures.previous.jsonl",
      ]);
    } finally {
      fs.rmSync(userDataPath, { recursive: true, force: true });
    }
  });

  it("rejects when the user-data log directory cannot be created", async () => {
    const tempPath = fs.mkdtempSync(path.join(os.tmpdir(), "agent-recall-index-log-"));
    const blockingPath = path.join(tempPath, "not-a-directory");
    fs.writeFileSync(blockingPath, "file");
    try {
      const logger = createSessionIndexFailureLogger(blockingPath);
      await expect(logger.write(diagnostic("codex:one"))).rejects.toThrow();
    } finally {
      fs.rmSync(tempPath, { recursive: true, force: true });
    }
  });
});
