# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MinuetAItor** is a meeting minutes management platform with AI-assisted generation, PDF rendering, and async job processing. It is a microservices application orchestrated with Docker Compose.

## Running the Project

```bash
# Start all services (development)
docker-compose -f docker-compose-dev.yml up -d

# Start a specific service
docker-compose -f docker-compose-dev.yml up -d backend

# View logs for a service
docker logs MinuetAItor-backend --tail 50 -f
docker logs MinuetAItor-pdf-worker --tail 40
```

Available dev URLs:
- Frontend: http://localhost:5173
- Backend API + Swagger: http://localhost:8000/v1/docs (dev only, via http://localhost:8080/api/v1/docs through Nginx)
- PhpMyAdmin: http://localhost:8082
- RedisInsight: http://localhost:5540
- MinIO Console: http://localhost:9001
- Mailpit: http://localhost:8025

## Environment Setup

Copy `.env.template` to `.env` and fill in secrets. Three environment layers:
- `.env` — base/common defaults
- `.env.dev`, `.env.qa`, `.env.prd` — environment-specific overrides

Key required values: `MARIADB_PASSWORD`, `JWT_SECRET`, `MINIO_ROOT_PASSWORD`, `OPENAI_API_KEY`.

## Testing PDF Generation

The PDF pipeline test runs **inside the Docker network** (it connects to `redis:6379` and `minio:9000`):

```bash
# 1. Place output.json (LLM JSON response) in:
#    APP/volumes/backend/app/assets/test/output.json

# 2. Exec into the backend container
docker exec -it MinuetAItor-backend bash

# 3. Run the test script
python app/assets/test/test_pdf_job.py                        # single template (opc_01)
python app/assets/test/test_pdf_job.py --template opc_02      # specific template
python app/assets/test/test_pdf_job.py --all                  # all 4 templates
python app/assets/test/test_pdf_job.py --all --watermark      # with BORRADOR watermark
```

The script enqueues a job in `queue:pdf`, waits up to 30 s for MinIO, and downloads the PDF locally.

## Architecture

### Services

| Service | Port | Description |
|---|---|---|
| `backend` | 8000 | FastAPI REST API, JWT auth, business logic |
| `worker` | — | Async Redis job processor (minutes, email, maintenance) |
| `pdf-worker` | — | Dedicated PDF generator (Gotenberg → MinIO) |
| `scheduler` | — | APScheduler cron daemon |
| `frontend` | 5173 | React + Vite SPA |
| `nginx` | 8080 | Reverse proxy (`/api` → backend, `/` → frontend) |

### Async Job Flow

1. A status change on a `Record` fires a SQLAlchemy `after_update` listener ([APP/volumes/backend/app/events/pdf_dispatch.py](APP/volumes/backend/app/events/pdf_dispatch.py)).
2. The listener calls `pdf_job_builder.py` to construct a job envelope and pushes it to `queue:pdf` in Redis.
3. The `pdf-worker` service (`BLPOP queue:pdf`) picks up the job, renders HTML via Gotenberg, and uploads the PDF to MinIO.
4. The general `worker` service handles `queue:minutes` (OpenAI calls), `queue:email`, and `queue:maintenance` with retry/DLQ logic.

### Backend Layer Structure

```
routers/v1/        → FastAPI route handlers (one file per domain entity)
routers/internal/  → Internal worker↔backend API (auth: X-Internal-Secret header)
services/          → Business logic
repositories/      → SQLAlchemy data access
schemas/           → Pydantic request/response models
models/            → SQLAlchemy ORM models
core/              → Config (pydantic-settings), middleware, auth, exceptions
events/            → SQLAlchemy listeners (e.g., PDF dispatch on status change)
db/                → DB and Redis connection factories
```

### API Conventions

- All public routes are prefixed `/v1/` and require JWT Bearer token.
- Internal routes (`/internal/...`) are protected by `X-Internal-Secret` header only — never exposed via Nginx.
- Responses are wrapped by `ResponseContractMiddleware` for a consistent envelope.
- Swagger UI available at `/v1/docs` in non-production environments.

### PDF Templates

Jinja2 HTML templates for PDF generation live in [APP/volumes/pdf-worker/app/templates/minutes/](APP/volumes/pdf-worker/app/templates/minutes/). Current templates: `opc_01` through `opc_04`. Gotenberg converts them to PDF.

### Database

MariaDB initialized from SQL scripts in `APP/data/settings/mariadb/init/`:
- `10_schema_tables_core.sql` — full schema
- `20_schema_alter_indexes.sql` — indexes
- `30_triggers.sql` — DB triggers
- `40_seeds_minimal.sql`, `50_seeds_minimal.sql` — system and usage seeds

Roles/Permissions are seed-managed only (not exposed via API) to prevent privilege escalation.

### Frontend

React 18 + Vite + Tailwind CSS v4. State management via Zustand. API calls via Axios services in `src/services/`. Routes defined in `src/routes/`.

## Key Design Decisions

- **Roles/Permissions/Sessions** are intentionally disabled from the public API (commented in `main.py`) — managed only via seeds or migration scripts.
- **GeoBlock** middleware restricts access by country (configured in `.env`; disabled in dev by default).
- **OpenAI model** defaults to `gpt-4o`; configurable via `OPENAI_MODEL` env var.
- **Internal API secret** (`INTERNAL_API_SECRET`) authenticates worker→backend calls inside Docker — never expose this to Nginx.
- The `pdf_dispatch` listener uses `audit-over-rollback`: it logs errors but never raises, so a PDF failure never rolls back the record update.
