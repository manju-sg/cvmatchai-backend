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
- `GEMINI_API_KEY`
- `RUN_JOB_WORKER=false` for the API process
- `RUN_JOB_WORKER=true` for the worker process

## Render

This repo now includes [render.yaml](/C:/Users/Manjunath/OneDrive/Documents/codex/CVMatchAI_copy/backend/render.yaml) to provision:

- one Node web service for the API
- one Node worker service for BullMQ processing
- one Postgres database
- one Redis instance

Use `npm run start:api` for the web service and `npm run start:worker` for the worker service.

## Production notes

- put the API behind Nginx or a cloud load balancer
- run the API service and worker service separately in production by setting `RUN_JOB_WORKER=false` on the API and `RUN_JOB_WORKER=true` on the worker
- use managed Postgres and managed Redis in Render, Railway, Neon, Upstash, or similar
- store uploaded files in object storage if you want resumable/retry-friendly pipelines
- keep the Gemini API key only on the backend, never in the mobile app
