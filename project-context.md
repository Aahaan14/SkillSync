# SkillSync — Project Context

## 1. Project Overview

**Project:** SkillSync — Career Intelligence Copilot

SkillSync is a career-intelligence platform that analyzes a user's profile against the live job market and produces a deterministic skill-alignment analysis plus AI-powered enrichment.

### Core goal

The system takes:

1. A user's profile
2. Target roles and/or locations
3. Live job-market data from SerpAPI / Google Jobs

It then:

1. Normalizes the user's profile and skills.
2. Searches the live job market.
3. Normalizes and deduplicates jobs.
4. Extracts canonical skills from jobs.
5. Calculates market demand for skills.
6. Compares user skills against market skills.
7. Calculates a deterministic alignment score.
8. Uses AI only for enrichment and recommendations.
9. Persists the analysis.
10. Displays the result through the Chrome extension and Next.js dashboard.

### Important product rule

**Deterministic market calculations are authoritative. AI is enrichment only.**

AI must never overwrite or replace:

- market skill demand
- deterministic skill gaps
- deterministic alignment score
- job counts
- normalized market data

The alignment score represents:

> How well the user's recognized skills align with the sampled market skills.

It is **not**:

- employment probability
- hiring probability
- interview probability
- salary prediction
- guarantee of getting a job

---

# 2. High-Level Architecture

```text
                    ┌─────────────────────┐
                    │     User Profile    │
                    │ Skills / Experience │
                    │ Education / Projects│
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Chrome Extension    │
                    │ React + TypeScript  │
                    │ Manifest V3         │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     FastAPI API     │
                    │ Auth / Profile /    │
                    │ Analysis / Market   │
                    └──────────┬──────────┘
                               │
             ┌─────────────────┼─────────────────┐
             ▼                 ▼                 ▼
        PostgreSQL           Redis            SerpAPI
             │                                   │
             │                                   ▼
             │                            Live Job Market
             │
             ▼
      Persisted Analyses
             │
             ▼
       AI Enrichment Layer
             │
             ▼
       Next.js Dashboard
```

### Backend stack

- Python
- FastAPI
- SQLAlchemy async
- Pydantic
- PostgreSQL
- Redis
- Alembic
- httpx
- pytest

### AI layer

Supported provider architecture:

- Grok
- OpenAI
- Gemini
- Anthropic

AI provider is selected through configuration such as `AI_PROVIDER`.

### Extension

- React
- TypeScript
- Tailwind CSS
- Vite
- Manifest V3

### Web dashboard

- Next.js
- React
- TypeScript
- Tailwind CSS
- Framer Motion
- Recharts
- Lucide

### External services

- SerpAPI / Google Jobs
- Configured AI provider

---

# 3. Data Model

## User

Important fields:

- `id`
- `email`
- `password_hash`
- `full_name`
- `role`
- timestamps

Relationships:

- one-to-one Profile
- one-to-many Analysis

User deletion cascades to related profile/analyses.

---

## Profile

Important fields:

- `id`
- `user_id`
- `skills`
- `experience`
- `education`
- `certifications`
- `projects`
- timestamps

`user_id` is unique/indexed.

Profile is linked one-to-one with the authenticated user.

---

## Analysis

Important fields:

- `id`
- `user_id`
- `status`
- `profile_snapshot`
- `search_queries`
- `market_jobs`
- `market_skills`
- `strengths`
- `skill_gaps`
- `ai_strengths`
- `ai_gaps`
- `ai_recommendations`
- `ai_relevant_roles`
- `ai_roadmap`
- deterministic alignment score fields
- timestamps
- `error_message`

Analysis statuses include:

- `PENDING`
- `SEARCHING`
- `ANALYZING`
- `COMPLETED`
- `FAILED`

---

# 4. Authentication and Ownership

Authentication uses:

- JWT
- HTTP-only cookies
- Argon2id password hashing

Important auth endpoints include:

```text
/api/auth/register
/api/auth/login
/api/auth/logout
/api/auth/refresh
/api/auth/me
```

Profile:

```text
GET /api/profile
PUT /api/profile
```

Analysis:

```text
POST /api/analysis
GET /api/analysis/latest
GET /api/analysis/{analysis_id}
GET /api/analysis
```

Market:

```text
POST /api/market/search
GET /api/market/skills
```

Admin routes also exist.

### Security rule

Ownership must always be derived from the authenticated user.

Never trust a client-provided user ID to determine ownership.

This protects against IDOR-style vulnerabilities.

---

# 5. Complete Project Workflow

The core analysis pipeline is:

```text
1. Profile normalization
        ↓
2. Search-query generation
        ↓
3. SerpAPI job search
        ↓
4. Job normalization
        ↓
5. Job deduplication
        ↓
6. Skill extraction
        ↓
7. Market-demand calculation
        ↓
8. User/market comparison
        ↓
9. Deterministic alignment score
        ↓
10. AI enrichment
        ↓
11. Persistence
        ↓
12. Dashboard / Extension presentation
```

This ordering is important.

AI comes **after** deterministic calculations.

---

# 6. Phase 1 — Development and Testing Foundation

## Status

**COMPLETE**

## Objective

Establish a reliable development and testing foundation.

## Work completed

- Created `pytest.ini`
- Fixed Python dependency issues
- Resolved Rust/orjson compatibility
- Pinned:
  - `orjson==3.9.15`
- Created/verified initial Alembic migration
- Initialized local database
- Verified backend imports/startup
- Added initial tests

Migration:

```text
072fa4c227a5
```

Alembic state:

```text
072fa4c227a5 (head)
```

## Verification

The backend test foundation was established and later expanded through subsequent phases.

---

# 7. Phase 2 — SerpAPI + Redis Caching

## Status

**COMPLETE**

## Objective

Integrate live job-market search and production-oriented caching.

## Work completed

- Integrated SerpAPI client
- Replaced in-memory caching with Redis
- Added Redis TTL configuration
- Added:
  - `SERPAPI_CACHE_TTL_HOURS`
- Added handling for:
  - HTTP 429
  - HTTP 5xx
- Added retry behavior
- Added cache tests

## Important behavior

Repeated equivalent searches should use Redis where appropriate instead of unnecessarily calling SerpAPI.

This reduces:

- API usage
- latency
- cost
- dependency pressure

Redis is an optimization layer; the application should still handle Redis failure gracefully where designed.

---

# 8. Phase 3 — Market Intelligence and Canonical Skills

## Status

**COMPLETE**

## Objective

Create consistent skill normalization across profiles and market data.

## Work completed

- Canonical skill normalization
- Skill aliases
- Word-boundary-safe matching
- Shared alias map
- Consistent normalization across:
  - profile skills
  - job skills
  - market demand
  - user/market comparison

Example:

```text
React.js → React
```

## Important rule

The same canonicalization logic must be reused throughout the system.

Do not create independent skill dictionaries for separate pipeline stages unless there is a strong architectural reason.

---

# 9. Phase 4 — Skill Alignment

## Status

**COMPLETE**

## Objective

Turn market data into deterministic skill-demand and alignment information.

## Market demand calculation

For each canonical skill:

```text
demand percentage =
jobs requiring skill / jobs analyzed × 100
```

Each skill counts at most once per unique job.

## Skill gaps

Skill gaps include information such as:

- canonical skill
- display name
- demand percentage
- jobs requiring skill
- priority rank

Skill gaps are sorted according to market demand.

## Deterministic alignment score

The score is calculated from:

```text
matched demand weight
---------------------- × 100
all recognized market demand weight
```

The result is:

```text
0–100
```

## Critical rule

The deterministic score is authoritative.

AI cannot modify the score.

---

# 10. Phase 5 — AI Hardening

## Status

**COMPLETE**

## Objective

Make AI enrichment structured, resilient, and safe.

## New components

```text
backend/app/services/ai/schemas.py
backend/app/services/ai/validation.py
backend/tests/test_ai_validation.py
```

## Work completed

- Pydantic validation of AI responses
- Plain JSON parsing
- Markdown fenced JSON parsing
- Malformed response handling
- Missing-field handling
- Incorrect-field handling
- Salvage/fallback behavior
- Retry logic
- Prompt-injection protection
- Explicit deterministic-vs-AI separation

## Retry behavior

Maximum retries:

```text
2
```

Exponential backoff is used where appropriate.

Retry conditions include:

- 429
- timeout
- 5xx

Do not retry authentication/authorization failures such as:

- 401
- 403

## Prompt injection protection

Untrusted job/profile data must not be treated as system instructions.

The system uses separation between:

- system instructions
- user/untrusted data

## AI failure rule

If AI fails:

```text
deterministic analysis must still succeed
```

AI failure must not destroy:

- job count
- market skills
- skill gaps
- alignment score

## Roadmap rule

AI-generated roadmap recommendations must be grounded in actual detected skill gaps.

---

# 11. Phase 6 — Analysis Pipeline Hardening

## Status

**COMPLETE**

## Objective

Make the complete analysis pipeline deterministic, resilient, and safe under failure.

## Required pipeline order

```text
1. Profile normalization
2. Query generation
3. SerpAPI
4. Job normalization
5. Deduplication
6. Skill extraction
7. Demand calculation
8. User/market comparison
9. Deterministic alignment
10. AI enrichment
11. Persistence
```

## Work completed

- SerpAPI timeout handling
- 429 handling
- 5xx handling
- Zero-job handling
- Partial job-field handling
- Duplicate-job removal
- Maximum 5 search queries
- Query deduplication
- AI called once
- AI called only after deterministic calculations
- AI failure resilience
- Persistence via flush
- API layer owns commit/rollback
- Concurrent analyses are independent
- Session-leak prevention

## Zero-job behavior

When there are no jobs:

```text
status = COMPLETED
jobs_analyzed_count = 0
market_skills = {}
alignment = 0
```

There must be:

- no NaN
- no infinity
- no fake skills

## Important test

A major regression test verified that even with:

- 50 jobs
- deterministic alignment of 73.4
- AI failure

the final result still preserves:

- all 50 jobs
- market skills
- skill gaps
- alignment score 73.4

---

# 12. Phase 7 — Database and Persistence Hardening

## Status

**COMPLETE**

## Objective

Make persistence, ownership, transactions, and database behavior reliable.

## Work completed

- Database model audit
- Ownership protection
- IDOR protection
- PostgreSQL architecture review
- Alembic verification
- Transaction-boundary review
- Failed-analysis persistence
- AI-failure persistence behavior
- Concurrent-analysis isolation
- Index review
- Cascade deletion
- JSON persistence
- Secure database error handling
- Database tests

## Tests

Phase 7 added approximately 18 database-focused tests.

Total backend tests after Phase 7:

```text
86 passed
```

## Alembic

Current/head:

```text
072fa4c227a5
```

## Important caveat

PostgreSQL compatibility was reviewed architecturally.

A full live PostgreSQL integration test should still be performed before final release.

---

# 13. Phase 8 — Chrome Extension

## Status

**Implementation/build COMPLETE**

**Manual browser E2E deferred to Phase 14**

## Objective

Allow users to extract their profile and start SkillSync analysis directly through a Chrome extension.

## Technology

- React
- TypeScript
- Tailwind
- Vite
- Manifest V3

## Main flow

```text
Chrome Extension
      ↓
Authenticate
      ↓
Extract profile
      ↓
Review profile
      ↓
Save profile
      ↓
Trigger analysis
      ↓
FastAPI
      ↓
Analysis pipeline
      ↓
Results
```

## Implemented

- Authentication
- Token/session handling
- LinkedIn extraction
- Generic extraction
- Profile save
- Analysis trigger
- Result display
- Error handling
- Minimum required permissions
- Build verification

## Known enhancement opportunities

- richer profile preview
- certifications extraction
- project extraction
- AI roadmap/recommendations in extension

These are not necessarily blockers for the phase.

## Manual E2E

Full browser-level verification has intentionally been deferred to Phase 14.

---

# 14. Phase 9 — Web Dashboard

## Status

**COMPLETE**

## Objective

Build a production-quality Next.js web dashboard that consumes the real backend.

## Existing web areas

```text
web/app/dashboard/
web/app/market/
web/app/profile/
web/app/roadmap/
web/app/skills/
```

Supporting API/types:

```text
web/lib/api.ts
web types
```

## Existing functionality

### Dashboard

Consumes:

- latest analysis
- alignment
- jobs analyzed
- role fit
- AI summary
- roles
- strengths
- gaps

### Market

Consumes:

- `market_skills`
- `jobs_analyzed_count`
- `search_queries`

Uses Recharts for visualization.

### Skills

Consumes:

- strengths
- skill gaps
- market percentages

### Roadmap

Consumes:

- `ai_roadmap`

### Profile

Consumes:

```text
GET /api/profile
```

## Known Phase 9 issues

### 1. Hard-coded API URL

`web/lib/api.ts` currently has/had a hard-coded:

```text
http://localhost:8000/api
```

It should use an environment variable such as:

```text
NEXT_PUBLIC_API_URL
```

### 2. Excessive `any`

Frontend types contain structures such as:

```text
Record<string, any>
any[]
```

These should be replaced with structured TypeScript types.

### 3. Loading states

Some pages can currently show blank UI while data is loading.

Every important data-driven page should have a meaningful loading state.

### 4. Empty states

A new user with no analysis should not see an unexplained blank page.

The UI should clearly explain what to do next.

### 5. Error states

The frontend needs appropriate handling for:

- 401
- 403
- 404
- 422
- 429
- 500
- network failure
- backend unavailable
- analysis failure
- AI unavailable

### 6. Profile editing

The backend supports:

```text
PUT /api/profile
```

The frontend is currently mainly read-only.

Decide/implement an appropriate profile edit/save experience.

### 7. AI unavailable state

AI fields can be null/empty.

The frontend must distinguish:

```text
Deterministic analysis succeeded
```

from:

```text
AI enrichment unavailable
```

AI failure should not make a valid deterministic analysis look like a total failure.

### 8. Frontend verification

The uploaded environment had not yet verified all frontend dependencies/build commands.

Need to install dependencies and run the actual project scripts.

Verify:

```text
npm install
npm run lint
npm run build
npx tsc --noEmit
```

Use the scripts that actually exist in `package.json`.

### 9. No duplicate business logic

The frontend must not recalculate:

- alignment score
- market demand
- skill matching

It should display backend-authoritative values.

### 10. No fake production data

Do not leave mock/demo numbers in production UI.

---

# 15. Phase 9 Acceptance Criteria

Phase 9 is complete only when:

- web dependencies install
- TypeScript passes
- lint passes
- production build passes
- dashboard consumes real backend
- market consumes real backend
- skills consumes real backend
- roadmap consumes real backend
- profile consumes real backend
- API URL is configurable
- loading states exist
- empty states exist
- error states exist
- AI-unavailable state exists
- frontend types are structured
- no production mock numbers exist
- backend's 86+ tests still pass

---

# 16. Phase 10 — API Contract Hardening

## Status

**COMPLETED**

## Objective

Create a stable contract between:

```text
Chrome Extension
        ↕
FastAPI
        ↕
Next.js
```

## Tasks

Audit:

- request formats
- response formats
- status codes
- authentication behavior
- error formats
- ownership semantics
- nullable fields
- AI fields
- deterministic fields

## Goals

- one source of truth
- consistent response models
- typed frontend responses
- no duplicated business logic
- contract tests

The extension and web dashboard should interpret backend responses consistently.

---

# 17. Phase 11 — Security Hardening

## Status

**IN PROGRESS**

## Areas to audit

### Authentication

- JWT behavior
- cookie configuration
- expiration
- refresh
- logout

### Cookies

Production should use appropriate:

```text
HttpOnly
Secure
SameSite
```

settings.

### CORS

Verify production origins and avoid overly broad policies.

### CSRF

Review cookie-based authentication and state-changing requests.

### Authorization

Verify:

- IDOR protection
- admin authorization
- authenticated ownership

### Password security

Verify Argon2id configuration.

### Secrets

Never expose:

- JWT secrets
- SerpAPI keys
- AI provider keys
- database credentials
- Redis credentials

to frontend or extension bundles.

### XSS / unsafe HTML

Audit scraped content and rendered content.

### Prompt injection

Continue protecting AI prompts from malicious job/profile data.

### Malicious scraped data

Treat external job descriptions and search results as untrusted.

### Extension permissions

Keep permissions minimal.

### Rate limiting

Review rate limits and input-size limits.

### SSRF / URL handling

Audit any functionality accepting external URLs.

### Logging

Never leak:

- tokens
- passwords
- API keys
- sensitive user information

through logs or errors.

---

# 18. Phase 12 — Docker and Production Infrastructure

## Status

**PLANNED**

## Target environment

Docker Compose should include:

```text
PostgreSQL 16
Redis 7
FastAPI
Next.js
```

## Tasks

- Dockerfiles
- Docker Compose
- production environment variables
- secret handling
- service networking
- health checks
- persistent database volumes
- Redis configuration
- migration startup strategy
- production server configuration
- production Next.js build
- production FastAPI server
- no development-only volumes
- no debug settings
- public API URL
- CORS configuration

## Verification

Run:

```text
docker compose build
docker compose up
```

Then verify:

- backend
- frontend
- PostgreSQL
- Redis
- migrations
- authentication
- analysis pipeline

---

# 19. Phase 13 — Documentation

## Status

**PLANNED**

Required documentation:

```text
README.md
docs/architecture.md
docs/api-contract.md
docs/demo.md
```

## README should cover

- project overview
- architecture
- setup
- environment variables
- backend setup
- PostgreSQL
- Redis
- SerpAPI
- AI providers
- extension
- web dashboard
- API
- migrations
- testing
- Docker
- demo workflow
- security
- limitations

## Important documentation rule

The current README contains an older phase plan.

It must be updated to reflect the current **15-phase plan**.

Do not document features that do not actually exist.

---

# 20. Phase 14 — Full End-to-End Testing

## Status

**PLANNED**

## Environment

Run:

- PostgreSQL
- Redis
- FastAPI
- Next.js
- Chrome extension

## Main E2E flow

```text
Register
   ↓
Login
   ↓
Supported profile
   ↓
Open extension
   ↓
Extract profile
   ↓
Review profile
   ↓
Save profile
   ↓
Run analysis
   ↓
SerpAPI
   ↓
Redis/cache
   ↓
Job normalization
   ↓
Deduplication
   ↓
Skill extraction
   ↓
Demand calculation
   ↓
Alignment score
   ↓
AI enrichment
   ↓
Persistence
   ↓
Extension results
   ↓
Dashboard results
```

## Cross-surface consistency

Verify that extension and web dashboard agree on:

- alignment score
- jobs analyzed
- market skills
- skill gaps
- strengths
- AI results where available

## Failure scenarios

Test:

- SerpAPI unavailable
- AI unavailable
- Redis unavailable
- database unavailable
- invalid authentication
- expired authentication
- empty profile
- zero jobs
- malformed job
- malformed AI response

---

# 21. Phase 15 — Final QA and Release

## Status

**PLANNED**

## Final audit

Search the entire project for:

```text
TODO
FIXME
mock
demo
localhost
hard-coded URLs
secrets
console.log
unsafe any
dead code
stale documentation
```

## Final verification

### Backend

- pytest
- compileall
- Alembic current
- Alembic heads
- PostgreSQL integration

### Web

- lint
- TypeScript
- production build

### Extension

- TypeScript
- build
- browser E2E

### Infrastructure

- Docker build
- Docker Compose
- migrations
- PostgreSQL
- Redis

### Security

- authentication
- authorization
- cookies
- CORS
- CSRF
- XSS
- prompt injection
- secrets
- logging
- rate limits
- extension permissions

### Documentation

- README
- architecture
- API contract
- demo
- limitations

---

# 22. Current Project Status

At the current checkpoint:

```text
Phase 1   ✅ Complete
Phase 2   ✅ Complete
Phase 3   ✅ Complete
Phase 4   ✅ Complete
Phase 5   ✅ Complete
Phase 6   ✅ Complete
Phase 7   ✅ Complete
Phase 8   ✅ Implementation/build complete
Phase 9   🟡 In progress
Phase 10  ⏳ Planned
Phase 11  ⏳ Planned
Phase 12  ⏳ Planned
Phase 13  ⏳ Planned
Phase 14  ⏳ Planned
Phase 15  ⏳ Planned
```

Backend regression baseline:

```text
86 tests passed
```

Alembic:

```text
072fa4c227a5 (head)
```

---

# 23. Critical Development Rules

Any future coding agent working on SkillSync must follow these rules.

## Rule 1 — Do not rewrite the project from scratch

The project already contains substantial working implementation.

Inspect first.

Modify incrementally.

---

## Rule 2 — Preserve completed phases

Do not redo:

- Redis caching
- canonical skill normalization
- deterministic alignment
- AI validation
- pipeline hardening
- database hardening
- extension implementation

unless a verified bug requires a change.

---

## Rule 3 — Deterministic analysis is authoritative

Never allow AI to overwrite:

```text
market_skills
skill_gaps
jobs_analyzed_count
alignment score
deterministic comparison
```

---

## Rule 4 — AI is enrichment

AI may provide:

- explanations
- recommendations
- relevant roles
- roadmap
- natural-language strengths
- natural-language gaps

But AI must not become the source of truth for deterministic calculations.

---

## Rule 5 — No fake data

Do not add production mock values just to make the UI look complete.

---

## Rule 6 — No secrets in client-side code

Never expose:

- SerpAPI keys
- AI API keys
- database credentials
- JWT signing secrets

in:

- Next.js client bundles
- extension bundles
- public environment variables

Only intentionally public configuration belongs in public variables.

---

## Rule 7 — Never trust client ownership IDs

Always derive ownership from the authenticated identity.

---

## Rule 8 — Do not disable tests

Do not:

- delete failing tests
- skip tests to make CI green
- weaken assertions
- disable validation

Fix the underlying issue.

---

## Rule 9 — Preserve API compatibility where possible

Existing extension/web/backend contracts should not be casually broken.

If a contract must change:

1. identify all consumers
2. update them consistently
3. add/update tests
4. document the change

---

## Rule 10 — Verify before claiming completion

Never say a phase is complete merely because code was changed.

Completion requires actual verification.

---

# 24. Recommended Agent Workflow

Any coding agent should follow this process:

## Step 1 — Inspect

Read:

- repository structure
- current phase status
- backend
- frontend
- extension
- tests
- package manifests
- environment examples
- Alembic state
- existing documentation

## Step 2 — Establish baseline

Run relevant tests/builds before modifying code.

## Step 3 — Identify gaps

Compare current implementation against the phase acceptance criteria.

## Step 4 — Implement minimally

Prefer targeted changes over rewrites.

## Step 5 — Test

Run affected tests.

## Step 6 — Regression test

Run the full relevant suite.

## Step 7 — Build

Verify production builds where applicable.

## Step 8 — Review

Search for:

- hard-coded URLs
- secrets
- mocks
- unsafe types
- dead code
- TODOs
- stale documentation

## Step 9 — Report honestly

For each phase report:

```text
Phase
Status
Audit performed
Changes made
Files changed
Tests run
Build results
Known limitations
Blockers
```

---

# 25. Important Existing Development Detail

When building the extension, a previous issue occurred because:

```text
npx vite build
```

was run from the repository root.

That caused `npx` to fetch a different Vite version.

The correct approach is to run commands inside the extension directory and use the project's declared dependencies/scripts.

Example:

```powershell
cd extension
npm install
npm run build
```

or, if needed:

```powershell
npx tsc -b
npx vite build
```

Do not upgrade dependencies simply because `npx` attempts to download another version.

---

# 26. Release Definition

SkillSync should only be considered production-ready after:

```text
Backend
   + Web
   + Chrome Extension
   + PostgreSQL
   + Redis
   + SerpAPI
   + AI provider
   + Authentication
   + Security
   + Docker
   + API contracts
   + E2E
   + Documentation
   + Final QA
```

have all been verified.

The project is currently **not yet at final release**.

The immediate priority is:

```text
Phase 9 — Web Dashboard
```

followed sequentially by:

```text
Phase 10 — API Contract Hardening
Phase 11 — Security
Phase 12 — Docker/Production
Phase 13 — Documentation
Phase 14 — Full E2E
Phase 15 — Final QA/Release
```

---

# 27. Current Baseline for Future Agents

Before making major changes, the agent should confirm:

```text
Backend tests: 86+ passing
Alembic: 072fa4c227a5 / head
Phases 1–7: complete
Phase 8: implementation/build complete; manual E2E deferred
Phase 9: in progress
```

The agent must then inspect the actual repository rather than assuming this document perfectly matches the current filesystem.

This document is the project-context baseline, not a substitute for repository inspection.
