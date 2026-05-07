const { Pool } = require("pg");

const { config } = require("../config");

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is required for Postgres-backed job storage.");
}

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.appEnv === "production" ? { rejectUnauthorized: false } : false,
});

async function initPostgres() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      jd_title TEXT NOT NULL,
      jd_content TEXT NOT NULL,
      model_preference TEXT NOT NULL,
      file_count INTEGER NOT NULL DEFAULT 0,
      files_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      results_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      comparative_summary TEXT NOT NULL DEFAULT '',
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_jobs_status_updated_at
    ON jobs (status, updated_at DESC);
  `);
}

module.exports = { pool, initPostgres };
