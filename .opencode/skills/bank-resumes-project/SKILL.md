---
name: bank-resumes-project
description: BankResume, bank-resumes, parser, web, Prisma, Next.js, FastAPI, PDFs BBVA/Galicia. Use when working on this repository to understand its architecture, data flow, conventions, entry points, and safe verification steps before editing.
---

# Bank Resumes Project

## Purpose

Use this skill for tasks inside the `bank-resumes` repository.

This project has two main apps:

- `web/`: Next.js 14 App Router, TypeScript, Tailwind, Prisma, SQLite locally.
- `parser/`: FastAPI service for parsing credit card statement PDFs.

The product manages Argentine credit card statements, imports PDFs from BBVA and Galicia, stores normalized data, and renders dashboards, statements, and transaction views.

## Architecture

Current high-level flow:

1. PDF upload enters through `web/src/app/api/statements/upload/route.ts`.
2. The web app currently parses the PDF locally with `web/src/lib/pdf-parser`.
3. Parsed data is persisted with Prisma into `Bank`, `Card`, `Statement`, `BalanceSummary`, and `Transaction`.
4. Dashboard and list pages read aggregated data from `web/src/lib/data.ts`.

Important nuance:

- `parser/` still exists and exposes `/api/v1/parse` via FastAPI.
- `web/src/lib/parser-client.ts` exists for calling that service.
- But the active upload path currently uses the in-process TypeScript parser, not the external Python service.
- Do not assume a change in `parser/` affects current uploads unless the web route is updated to use `parser-client.ts`.

## Key Files

Read these first when the task touches the corresponding area:

- Root overview: `README.md`
- Upload and persistence: `web/src/app/api/statements/upload/route.ts`
- Local PDF parsing entry point: `web/src/lib/pdf-parser/index.ts`
- Prisma schema: `web/prisma/schema.prisma`
- Dashboard aggregations: `web/src/lib/data.ts`
- Auth/session helpers: `web/src/lib/auth.ts`
- Route protection and RBAC: `web/src/middleware.ts`
- Transactions API: `web/src/app/api/transactions/route.ts`
- Python parser API: `parser/routers/parse.py`
- Python parser models: `parser/models/schema.py`

## Project Conventions

### Web

- Use App Router patterns already present in `web/src/app`.
- Prefer existing server-side data flow patterns over introducing client fetching.
- Use `@/` imports consistently.
- API handlers typically return `NextResponse.json(...)` with Spanish error messages.
- Auth is cookie/JWT-based through `getSession()` and `verifyToken()`.
- Admin-only access is enforced in `web/src/middleware.ts`.

### Database

- Prisma is the source of truth for persisted models.
- Local DB is SQLite by default; README notes PostgreSQL for production.
- Transaction lists and aggregates usually filter `deletedAt: null`.
- User-scoped reads should usually filter by `session.userId` unless the feature is intentionally admin/global.

### Parsing

- Bank detection is currently string-based in `web/src/lib/pdf-parser/index.ts` and in `parser/parsers/base.py`.
- Supported banks are BBVA and Galicia.
- Parser outputs use snake_case fields such as `merchant_name`, `balance_summary`, and `card_last_four`.
- Persistence code maps parser snake_case into Prisma camelCase fields.

## Editing Guidance

When implementing changes:

1. Confirm whether the behavior lives in `web/` or `parser/` before editing.
2. Prefer minimal changes in the existing layer instead of adding a second path.
3. If changing imported statement data, check both parser output types and Prisma persistence mapping.
4. If changing user-facing data visibility, verify session filtering and middleware behavior.
5. If changing dashboard totals, inspect `web/src/lib/data.ts` first because many values are computed there.

## Common Traps

- Do not assume `parser/` is the active upload parser path.
- Do not forget `deletedAt: null` when changing transaction queries.
- Do not break snake_case parser payloads unless all consumers are updated.
- Do not add a new bank parser in only one implementation if the task expects parity across web and Python parsers.
- Do not bypass `getSession()` for protected API routes.

## Verification

Choose the smallest relevant verification:

### Web changes

Run from `web/`:

```bash
npm run lint
```

If the change affects Prisma schema or DB behavior, also consider:

```bash
npm run db:push
```

### Parser changes

Run from `parser/`:

```bash
uvicorn main:app --port 8001 --reload
```

Then verify:

- `GET /health` returns OK.
- `POST /api/v1/parse` still accepts PDFs and preserves the expected response shape.

### End-to-end upload changes

Verify with a real BBVA or Galicia PDF if available:

1. Upload succeeds or returns a deliberate validation error.
2. Duplicate detection still returns `409` when re-uploading the same file.
3. `Statement`, `BalanceSummary`, and `Transaction` persistence still line up.
4. Dashboard and statement detail pages still render imported data.

## Task Routing Hints For Agents

- UI/page/layout issue: start in `web/src/app` and `web/src/components`.
- Aggregation/reporting mismatch: start in `web/src/lib/data.ts`.
- Upload/import bug: start in `web/src/app/api/statements/upload/route.ts` and `web/src/lib/pdf-parser`.
- Auth/access bug: start in `web/src/lib/auth.ts` and `web/src/middleware.ts`.
- Schema/data integrity change: start in `web/prisma/schema.prisma` and affected API routes.
- Parser-service task: start in `parser/main.py`, `parser/routers/parse.py`, and `parser/parsers/`.

## Definition Of Done

Before finishing, confirm:

- The edited layer is the one actually used by the feature.
- Data shape changes are consistent across parser, API, and Prisma mapping.
- Relevant auth and user scoping rules still hold.
- At least one targeted verification step was run or an explicit limitation was documented.
