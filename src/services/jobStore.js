const { pool } = require("./postgres");

function mapRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    status: row.status,
    progress: row.progress,
    jdTitle: row.jd_title,
    jdContent: row.jd_content,
    modelPreference: row.model_preference,
    fileCount: row.file_count,
    files: row.files_json || [],
    results: row.results_json || [],
    comparativeSummary: row.comparative_summary || "",
    error: row.error || null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

async function createJob(job) {
  const result = await pool.query(
    `
      INSERT INTO jobs (
        id, status, progress, jd_title, jd_content, model_preference, file_count,
        files_json, results_json, comparative_summary, error, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13)
      RETURNING *
    `,
    [
      job.id,
      job.status,
      job.progress,
      job.jdTitle,
      job.jdContent,
      job.modelPreference,
      job.fileCount,
      JSON.stringify(job.files || []),
      JSON.stringify(job.results || []),
      job.comparativeSummary || "",
      job.error || null,
      job.createdAt,
      job.updatedAt,
    ]
  );

  return mapRow(result.rows[0]);
}

async function updateJob(job) {
  const result = await pool.query(
    `
      UPDATE jobs
      SET
        status = $2,
        progress = $3,
        jd_title = $4,
        jd_content = $5,
        model_preference = $6,
        file_count = $7,
        files_json = $8::jsonb,
        results_json = $9::jsonb,
        comparative_summary = $10,
        error = $11,
        updated_at = $12
      WHERE id = $1
      RETURNING *
    `,
    [
      job.id,
      job.status,
      job.progress,
      job.jdTitle,
      job.jdContent,
      job.modelPreference,
      job.fileCount,
      JSON.stringify(job.files || []),
      JSON.stringify(job.results || []),
      job.comparativeSummary || "",
      job.error || null,
      job.updatedAt,
    ]
  );

  return mapRow(result.rows[0]);
}

async function getJob(jobId) {
  const result = await pool.query(`SELECT * FROM jobs WHERE id = $1 LIMIT 1`, [jobId]);
  return mapRow(result.rows[0]);
}

module.exports = { createJob, updateJob, getJob };
