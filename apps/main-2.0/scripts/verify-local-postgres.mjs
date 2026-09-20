#!/usr/bin/env node
// Run with: node --import tsx scripts/verify-local-postgres.mjs <local-review-app>
// Synthetic data only; refuses arbitrary installed bundles or database URLs.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { startPostgresRuntime } from "../src/main/postgres/managed-postgres.ts";
import { PostgresDatabase } from "../src/core/postgres/database.ts";
import { POSTGRES_MIGRATIONS } from "../src/core/postgres/schema.ts";
import { SessionStore } from "../src/core/session-store.ts";
import { SessionIndexFailures } from "../src/core/session-index-failures.ts";
import { syncLoadedSessionsInBatches } from "../src/core/indexer.ts";
import { searchSessions } from "../bin/agent-recall-mcp.mjs";

const appPath = await fs.realpath(process.argv[2]);
const outputRoot = path.dirname(appPath);
assert.equal(path.dirname(outputRoot), await fs.realpath(os.tmpdir()));
assert.match(path.basename(outputRoot), /^agent-recall-local-app-/);
assert.equal(path.basename(appPath), "AgentRecall.app");
const bundledRequire = createRequire(path.join(appPath, "Contents/Resources/app/package.json"));
const { default: EmbeddedPostgres } = await import(pathToFileURL(bundledRequire.resolve("embedded-postgres")).href);
const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-recall-native-pg-"));
const marker = "UNIQUE_KEYWORD_AT_VERY_END_928374";
const content = `${Array.from({ length: 250_000 }, (_, index) => `token${index.toString(36).padStart(7, "0")}`).join(" ")} ${marker}`;
assert.ok(Buffer.byteLength(content) > 3 * 1024 * 1024);
const item = {
  session: { sessionKey: "codex:local-regression", rawId: "local-regression", source: "codex-cli",
    projectPath: path.join(testRoot, "project"), filePath: path.join(testRoot, "synthetic.jsonl"),
    originalTitle: "Synthetic native regression", firstQuestion: "Synthetic question", timestamp: 1,
    fileMtimeMs: 1, fileSize: 5, prUrl: null, prNumber: null },
  messages: [{ role: "user", content: "small preserved content", timestamp: "2026-09-20T00:00:00Z", index: 0 }],
};
let runtime;
let database;
let freshDatabase;
async function verifyCurrent(db) {
  const columns = await db.query("select column_name from information_schema.columns where table_schema='agent_recall' and table_name='session_turns'");
  assert.ok(columns.rows.some(row => row.column_name === "search_text"));
  assert.ok(!columns.rows.some(row => row.column_name === "search_vector"));
  const indexes = await db.query("select indexname from pg_indexes where schemaname='agent_recall' and tablename='session_turns'");
  assert.ok(!indexes.rows.some(row => row.indexname === "session_turns_search_vector_idx"));
  assert.ok(indexes.rows.some(row => row.indexname === "session_turns_search_text_trgm_idx"));
  const stored = await db.query(`select m.content, t.search_text from agent_recall.turn_messages m
    join agent_recall.session_turns t on t.id=m.turn_id where t.session_key=$1`, [item.session.sessionKey]);
  assert.equal(stored.rows.length, 1);
  assert.equal(stored.rows[0].content, content);
  assert.ok(stored.rows[0].search_text.endsWith(marker));
  const store = new SessionStore(db);
  assert.equal((await store.searchSessions({ query: marker }))[0]?.sessionKey, item.session.sessionKey);
  assert.equal((await searchSessions(db, { query: marker }))[0]?.sessionKey, item.session.sessionKey);
}
try {
  runtime = await startPostgresRuntime({
    userDataPath: testRoot, environment: {},
    createEmbedded: options => new EmbeddedPostgres(options),
  });
  assert.equal(runtime.managed, true);
  assert.equal(new URL(runtime.connectionUrl).hostname, "127.0.0.1");
  database = PostgresDatabase.connect(runtime.connectionUrl, { migrations: POSTGRES_MIGRATIONS.filter(m => m.version <= 55) });
  await database.initialize();
  const location = (await database.query("show data_directory")).rows[0].data_directory;
  assert.equal(await fs.realpath(location), await fs.realpath(path.join(testRoot, "postgres/data")));
  const legacyStore = new SessionStore(database);
  await legacyStore.upsertIndexedSession(item.session, item.messages);
  await database.query("update agent_recall.sessions set custom_title='preserved title', favorited=true where session_key=$1", [item.session.sessionKey]);
  item.session.fileMtimeMs++;
  item.session.fileSize = Buffer.byteLength(content);
  item.messages[0].content = content;
  const failures = new SessionIndexFailures();
  const diagnostics = [];
  const failed = await syncLoadedSessionsInBatches(legacyStore, [item], { failureState: failures, logIndexFailure: diagnostic => { diagnostics.push(diagnostic); } });
  assert.equal(failed.indexed, 0);
  assert.equal(failed.skipped, 1);
  assert.match(diagnostics[0].error.message, /string is too long for tsvector/);
  assert.ok(failures.deferred(item.session));
  assert.equal((await database.query("select content from agent_recall.turn_messages")).rows[0].content, "small preserved content");
  await database.close();
  database = PostgresDatabase.connect(runtime.connectionUrl, { migrations: POSTGRES_MIGRATIONS });
  await database.initialize();
  assert.equal((await database.query("select content from agent_recall.turn_messages")).rows[0].content, "small preserved content");
  const store = new SessionStore(database);
  for (let index = 0; index < 3; index++) {
    item.session.fileMtimeMs++;
    const status = await syncLoadedSessionsInBatches(store, [item], { failureState: new SessionIndexFailures() });
    assert.equal(status.error, null);
    assert.equal(status.indexed, 1);
    await verifyCurrent(database);
  }
  const state = (await database.query("select custom_title, favorited from agent_recall.sessions where session_key=$1", [item.session.sessionKey])).rows[0];
  assert.deepEqual(state, { custom_title: "preserved title", favorited: true });
  await database.query("create database agent_recall_fresh_regression");
  const freshUrl = new URL(runtime.connectionUrl);
  freshUrl.pathname = "/agent_recall_fresh_regression";
  freshDatabase = PostgresDatabase.connect(freshUrl.href, { migrations: POSTGRES_MIGRATIONS });
  await freshDatabase.initialize();
  await new SessionStore(freshDatabase).upsertIndexedSession(item.session, item.messages);
  await verifyCurrent(freshDatabase);
  const result = { status: "PASS", bytes: Buffer.byteLength(content), oldSchemaError: diagnostics[0].error.message,
    upgrade: "55 -> 56", repeatedIndexes: 3, exactReadback: true, uiTailSearch: true, mcpTailSearch: true,
    preservedUserState: true, freshSchema: true, nativeVersion: (await database.query("show server_version")).rows[0].server_version };
  await fs.writeFile(path.join(outputRoot, "native-postgres-result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  try {
    await freshDatabase?.close();
  } finally {
    try { await database?.close(); }
    finally { await runtime?.stop(); }
  }
  await assert.rejects(fs.access(path.join(testRoot, "postgres/data/postmaster.pid")), /ENOENT/);
  await fs.rm(testRoot, { recursive: true, force: true });
}
