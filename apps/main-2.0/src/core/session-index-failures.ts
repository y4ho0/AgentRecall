import { createHash } from "node:crypto";
import type { SessionIndexFailureDiagnostic } from "./indexer";
import type { IndexedSession } from "./types";

export function indexFailureFingerprint(diagnostic: SessionIndexFailureDiagnostic): string {
  return createHash("sha256").update(JSON.stringify([
    diagnostic.sessionKey, diagnostic.source, diagnostic.filePath,
    diagnostic.revision ?? null,
    diagnostic.error.name, diagnostic.error.message.trim().replace(/\s+/gu, " "),
  ])).digest("hex");
}

function sourceRevision(session: IndexedSession): string {
  return JSON.stringify([session.source, session.filePath, session.fileMtimeMs, session.fileSize]);
}

// Process-owned: restarting after an app/schema upgrade immediately retries all
// sources. Diagnostics are persisted separately; no durable blacklist is created.
export class SessionIndexFailures {
  private readonly failures = new Map<string, {
    revision: string;
    fingerprint: string;
    count: number;
    retryAt: number;
    diagnostic: SessionIndexFailureDiagnostic;
  }>();

  constructor(private readonly now: () => number = Date.now) {}

  deferred(session: IndexedSession): SessionIndexFailureDiagnostic | undefined {
    const failure = this.failures.get(session.sessionKey);
    return failure?.revision === sourceRevision(session) && this.now() < failure.retryAt
      ? failure.diagnostic : undefined;
  }

  record(session: IndexedSession, diagnostic: SessionIndexFailureDiagnostic): SessionIndexFailureDiagnostic {
    const enriched = { ...diagnostic, revision: { fileMtimeMs: session.fileMtimeMs, fileSize: session.fileSize } };
    const fingerprint = indexFailureFingerprint(enriched);
    const previous = this.failures.get(session.sessionKey);
    const count = previous?.fingerprint === fingerprint ? previous.count + 1 : 1;
    this.failures.delete(session.sessionKey);
    this.failures.set(session.sessionKey, {
      revision: sourceRevision(session), fingerprint, count,
      retryAt: this.now() + Math.min(15 * 60_000, 30_000 * 2 ** Math.min(count - 1, 5)),
      diagnostic: enriched,
    });
    // Eviction permits another attempt; it never suppresses a source forever.
    if (this.failures.size > 1_000) this.failures.delete(this.failures.keys().next().value!);
    return enriched;
  }

  recovered(sessionKey: string): void {
    this.failures.delete(sessionKey);
  }
}
