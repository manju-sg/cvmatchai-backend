# CVMatch Backend

Production-oriented backend for CVMatch AI with:

- asynchronous job submission and polling
- server-side PDF and DOCX parsing
- bounded concurrency so large CV batches do not overwhelm the API process
- low-cost first-pass scoring with Gemini 2.5 Flash for backend reasoning refinement
- a backend-first architecture ready to move from single-instance to queued workers

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

## Install

```bash
npm install
npm start
```

## Production notes

- put the API behind Nginx or a cloud load balancer
- move job state from JSON storage to Postgres for multi-instance deployments
- move the queue from in-process memory to Redis/BullMQ if you need horizontal scaling
- store uploaded files in object storage if you want resumable/retry-friendly pipelines
- keep the Gemini API key only on the backend, never in the mobile app
