import pg from "pg";
import type { Attempt } from "./schemas.js";

/**
 * Postgres attempts ledger. This is durable analytics, SEPARATE from the LangGraph
 * checkpointer. The in-session summary reads from state.attempts (source of truth);
 * this table exists for cross-session analysis and to satisfy the "Backend: Postgres"
 * requirement alongside the checkpointer.
 *
 * In MemorySaver mode (USE_MEMORY_SAVER=true) the pool is null and every call no-ops —
 * the in-state attempts copy is enough to run the whole lesson without Docker.
 */

const useMemory = process.env.USE_MEMORY_SAVER === "true";

const pool: pg.Pool | null =
  useMemory || !process.env.DATABASE_URL
    ? null
    : new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        // pg defaults to NO connect timeout; without this, an unreachable DB host
        // would hang ledger writes indefinitely.
        connectionTimeoutMillis: 2000,
      });

let migrated = false;

async function ensureSchema(): Promise<void> {
  if (!pool || migrated) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attempts (
      id             BIGSERIAL PRIMARY KEY,
      thread_id      TEXT NOT NULL,
      question_id    TEXT NOT NULL,
      objective_id   TEXT NOT NULL,
      selected       CHAR(1) NOT NULL,
      is_correct     BOOLEAN NOT NULL,
      attempt_number INT NOT NULL,
      used_hint      BOOLEAN NOT NULL DEFAULT FALSE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_attempts_thread ON attempts(thread_id);
  `);
  migrated = true;
}

export async function recordAttempt(a: Attempt, threadId: string): Promise<void> {
  if (!pool) return; // MemorySaver mode
  try {
    await ensureSchema();
    await pool.query(
      `INSERT INTO attempts (thread_id, question_id, objective_id, selected, is_correct, attempt_number, used_hint)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [threadId, a.questionId, a.objectiveId, a.selected, a.isCorrect, a.attemptNumber, a.usedHint],
    );
  } catch (err) {
    // Never let a ledger write break the lesson — state is the source of truth.
    console.error("[db] recordAttempt failed (continuing):", (err as Error).message);
  }
}

export function isPostgresEnabled(): boolean {
  return pool !== null;
}
