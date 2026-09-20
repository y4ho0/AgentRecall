import { describe, expect, it } from "vitest";
import { SessionIndexFailures } from "./session-index-failures";
import type { IndexedSession } from "./types";

const session: IndexedSession = {
  sessionKey: "codex:failed", rawId: "failed", source: "codex-app",
  projectPath: "/fixture", filePath: "/fixture/session.jsonl",
  originalTitle: "Test", firstQuestion: "Test", timestamp: 1,
  fileMtimeMs: 1, fileSize: 10, prUrl: null, prNumber: null,
};
const diagnostic = {
  source: session.source, sessionKey: session.sessionKey, filePath: session.filePath,
  error: { name: "Error", message: "write failed", stack: null },
};

describe("session indexing backoff", () => {
  it("backs off unchanged failures, retries changed revisions and resets after recovery/restart", () => {
    let now = 0;
    const state = new SessionIndexFailures(() => now);
    state.record(session, diagnostic);
    expect(state.deferred(session)).toMatchObject(diagnostic);
    expect(state.deferred({ ...session, fileMtimeMs: 2 })).toBeUndefined();
    expect(state.deferred({ ...session, fileSize: 11 })).toBeUndefined();
    now = 30_000;
    expect(state.deferred(session)).toBeUndefined();
    state.record(session, diagnostic);
    now = 60_000;
    expect(state.deferred(session)).toBeDefined();
    now = 90_000;
    expect(state.deferred(session)).toBeUndefined();
    state.record(session, diagnostic);
    expect(new SessionIndexFailures(() => now).deferred(session)).toBeUndefined();
    state.recovered(session.sessionKey);
    expect(state.deferred(session)).toBeUndefined();
    state.record(session, diagnostic);
    now += 30_000;
    expect(state.deferred(session)).toBeUndefined();
  });
});
