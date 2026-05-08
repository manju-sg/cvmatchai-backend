# CVMatch Backend

Production-oriented backend for CVMatch AI with:

- asynchronous job submission with Redis/BullMQ
- Postgres-backed job state
- live progress streaming over SSE with polling fallback
- server-side PDF and DOCX parsing
- bounded worker concurrency so large CV batches do not overwhelm the API process
- low-cost first-pass scoring with Gemini 2.5 Flash for backend reasoning refinement
- a backend-first architecture ready for separate API and worker services

## Recommended model setup

- `GEMINI_MODEL=gemini-2.5-flash`

This keeps most of the workload cheap and fast:

- heuristic scoring does the heavy lifting across large CV batches
- Gemini 2.5 Flash is used server-side to refine the comparative summary and candidate reasoning

## API

`POST /api/jobs/submit`

Multipart form fields:

- `jdTitle`
- `jdContent`
- `modelPreference`
- `cvs` repeated for each uploaded CV

Response:

```json
{
  "jobId": "uuid",
  "status": "queued",
  "pollUrl": "/api/jobs/uuid",
  "resultUrl": "/api/jobs/uuid/results"
}
```

`GET /api/jobs/:jobId`

Returns status and progress.

`GET /api/jobs/:jobId/results`

Returns final candidate scores and comparative summary.

`GET /api/jobs/:jobId/events`

Streams live progress via Server-Sent Events.

## Install

```bash
npm install
npm run start:api
# in a separate process
npm run start:worker
```

Required environment:

- `DATABASE_URL`
- `REDIS_URL`
- `GEMINI_API_KEY` or `GEMINI_API_KEYS`
- `RUN_JOB_WORKER=true` for single-service free mode

If you want to spread load across multiple Gemini keys, set:

```env
GEMINI_API_KEYS=key_1,key_2,key_3,key_4,key_5
```

The backend will rotate across them and retry another key on rate-limit or transient provider errors.

## Render

This repo now includes [render.yaml](/C:/Users/Manjunath/OneDrive/Documents/codex/CVMatchAI_copy/backend/render.yaml) for a lower-cost single web service setup:

- one Node web service running both API and worker logic
- one Postgres database
- one Redis instance

Use `npm run start:api` for the web service with `RUN_JOB_WORKER=true`.

## Production notes

- put the API behind Nginx or a cloud load balancer
- free mode can run both API and worker in one web service by setting `RUN_JOB_WORKER=true`
- if you scale up later, split API and worker into separate services
- use managed Postgres and managed Redis in Render, Railway, Neon, Upstash, or similar
- store uploaded files in object storage if you want resumable/retry-friendly pipelines
- keep the Gemini API key only on the backend, never in the mobile app
