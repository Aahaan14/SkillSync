# API Contract

Source of truth, in order:

1. **Pydantic models** in `backend/app/schemas/` and the route decorators in `backend/app/api/routes/`.
2. **`docs/openapi.json`**, generated from (1) by `python backend/scripts/export_openapi.py`. A backend test fails if it is stale, so any API change shows up in review.
3. **Client mirrors**: `web/types/index.ts` and `extension/src/types/api.ts`. They are hand-written (no code generation) and `backend/tests/test_client_contract.py` fails if their field names, enum values or profile limits drift from (1).

Changing the API: edit the schema/route, run the export script, update both client mirrors, run `pytest`.

## Conventions

| Topic | Rule |
|---|---|
| Base path | Everything is under `/api`. Clients take the **origin** from config (`NEXT_PUBLIC_API_URL`, `VITE_API_URL`) and append `/api`. |
| Content type | JSON in, JSON out. |
| Nullable fields | Optional values are always present as `null`, never omitted. Profile lists are `[]`, never `null`. |
| Timestamps | ISO-8601 strings (`GET /market/skills` `analysis_date` too). |
| IDs | Integers. Identity always comes from the token, never from the request body or URL. |
| Pagination | None. `GET /analysis` returns the 20 newest analyses, newest first. |
| Rate limiting | **Not enforced by the backend yet** (the settings exist but are unused; Phase 11). The API never produces `429` itself; clients still handle it. |

## Authentication

Two equivalent credentials. The first one that validates wins (Bearer, then cookie):

* **Cookie `access_token`** (HTTP-only), set by register/login/refresh. Used by the web dashboard (`credentials: 'include'`).
* **`Authorization: Bearer <access_token>`**, used by the Chrome extension because HTTP-only cookies are not sent from `chrome-extension://` pages. The token comes from the `access_token` field of the register/login response and is kept in `chrome.storage.local`.

`refresh_token` is an HTTP-only cookie scoped to `/api/auth/refresh` and is never returned in a body. Access tokens are rejected as refresh tokens and vice versa.

`GET /api/auth/me` is the authoritative "who am I". Clients must check it (or a 401) instead of assuming a login worked.

## Error format

```jsonc
// 400, 401, 403, 404, 409, 429, 500, 503
{ "detail": "Human readable message" }

// 422 validation. Submitted values are NOT echoed back.
{ "detail": [ { "loc": ["body", "profile_url"], "msg": "...", "type": "value_error" } ] }
```

Clients must treat `detail` as `string | ValidationIssue[]`. 500 responses always carry `An unexpected error occurred. Please try again later.` (no stack traces, paths, SQL or provider output).

| Code | Meaning in this API |
|---|---|
| 400 | `POST /analysis` without a saved profile |
| 401 | Missing/invalid/expired credentials, user no longer exists, bad login, bad refresh token |
| 403 | Authenticated but not an admin (`/admin/*`) |
| 404 | Resource missing **or owned by someone else** (never 403, so ids cannot be probed) |
| 409 | Email already registered |
| 422 | Body or path failed validation |
| 500 | Unexpected error (generic message) |
| 503 | `POST /market/search` raised (search unavailable) |

## Endpoints

"Auth" means a valid cookie or bearer token. Models live in `backend/app/schemas/__init__.py`.

### Auth

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/auth/register` | no | `{email, password, full_name?}` | **201** `UserResponse`, sets both cookies | 409, 422 |
| POST | `/auth/login` | no | `{email, password}` | **200** `UserResponse`, sets both cookies | 401 (same message for wrong password and unknown email), 422 |
| POST | `/auth/logout` | no (idempotent) | none | **200** `{message}`, expires both cookies with the same Path/Domain/Secure/HttpOnly/SameSite they were set with | none |
| POST | `/auth/refresh` | refresh cookie | none | **200** `{access_token, token_type: "bearer"}`, rotates both cookies | 401 |
| GET | `/auth/me` | yes | none | **200** `UserResponse` | 401 |

`UserResponse`: `id, email, full_name|null, role ("user"|"admin"), created_at, updated_at, access_token|null`. `access_token` is populated by **register and login only** (it exists for the extension; the dashboard ignores it) and is `null` from `/auth/me`.

### Profile (one per user; owner = token identity)

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| GET | `/profile` | yes | none | **200** `ProfileResponse` | 401, 404 (no profile yet) |
| PUT | `/profile` | yes | `ProfileCreate` | **200** `ProfileResponse` (create and update; full replace of the same row) | 401, 422 |

`ProfileCreate` scalars (all optional/nullable): `name (1-100), headline (<=500), about (<=10000), location (<=200), profile_url (http/https, <=2048), source (<=50)`. Lists: `skills (<=200), experience (<=50), education (<=20), certifications (<=50), projects (<=50)`, of:

* `SkillItem {name 1-100, endorsements? >= 0}`
* `ExperienceItem {title 1-200, company?, location?, start_date?, end_date?, description?}`
* `EducationItem {institution 1-200, degree?, field_of_study?, start_date?, end_date?}`
* `CertificationItem {name 1-200, issuer?, date?}`
* `ProjectItem {name 1-200, description?, url? (http/https)}`

`ProfileResponse` has the same fields plus `id, user_id, created_at, updated_at`. An empty body `{}` is a valid profile. `name` must be at least 1 character **if sent**: send `null`, not `""`.

### Analysis

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/analysis` | yes | `{target_roles: string[], target_locations: string[]}` | **201** `AnalysisResponse` (runs synchronously; can take a minute) | 400, 401, 422 |
| GET | `/analysis` | yes | none | **200** `AnalysisResponse[]` (<= 20, newest first) | 401 |
| GET | `/analysis/latest` | yes | none | **200** `AnalysisResponse` | 401, 404 (never analysed) |
| GET | `/analysis/{analysis_id}` | yes | integer id | **200** `AnalysisResponse` | 401, 404 (missing or not yours), 422 |

**`POST /analysis` returns 201 even when the run failed.** The body then has `status: "failed"` and a generic `error_message`. `latest` and the list can also return failed or in-progress runs. Clients must check `status` before rendering results.

`AnalysisResponse` (every field is always present):

| Field | Type | Origin |
|---|---|---|
| `id` | int | |
| `status` | `pending` / `searching` / `analyzing` / `completed` / `failed` | |
| `jobs_analyzed_count` | int | deterministic |
| `market_skills` | `{ [canonicalSkill]: {canonical_skill, display_name, count, jobs_requiring, percentage 0-100} }` or null | deterministic |
| `strengths`, `skill_gaps` | `SkillComparison[]` or null: `skill, canonical_skill, display_name, market_percentage, demand_percentage, market_count, jobs_requiring, status ("strong"/"missing"), priority_rank` (rank only on gaps, null on strengths) | deterministic |
| `skill_alignment`, `overall_alignment_score` | float 0-100 or null | **deterministic, authoritative, always equal** |
| `search_queries` | string[] or null | deterministic |
| `role_alignment`, `education_alignment`, `experience_alignment` | float 0-100 or null | AI context only |
| `ai_summary`, `ai_strengths`, `ai_gaps`, `ai_recommendations` (`{action, reason, priority}`), `ai_relevant_roles`, `ai_roadmap` (`{skill, priority 1-10, reasoning}`) | nullable | AI enrichment only |
| `error_message` | string or null | generic text, never provider or internal detail |
| `created_at`, `updated_at` | ISO string | |

Rules clients can rely on:

* The AI can never change a deterministic field. Clients **must not** compute their own score; show `overall_alignment_score` as given, and show `null` as "no score", not `0%`.
* Zero jobs: `status "completed"`, `jobs_analyzed_count 0`, `market_skills {}`, `strengths []`, `skill_gaps []`, both scores `0.0`. The AI is not called, so all `ai_*` fields are empty or null.
* `strengths` and `skill_gaps` partition `market_skills`. Skill keys are lower-case canonical names and unique.
* Stored server-side but **not exposed**: `profile_snapshot`, `market_jobs`.

### Market

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/market/search` | yes | `{query 2-500, location?, num_results 1-50 (default 10)}` | **200** `{query, jobs, total_results, cached}` | 401, 422, 503 |
| GET | `/market/skills` | yes | none | **200** `{market_skills, jobs_analyzed_count, analysis_date}` from the latest analysis | 401, 404 |

`jobs[]`: `title (never null, "Unknown" fallback), company|null, location|null, skills string[], experience|null, education|null, salary|null, employment_type|null, source|null, url|null`.

Known limitations:

* A provider failure inside the search service surfaces as **200 with zero jobs**; the 503 only covers unexpected exceptions.
* `cached` is currently always `false`.
* `GET /market/skills` answers 404 for a completed zero-job analysis, because an empty skills object counts as "no data".
* Neither the web dashboard nor the extension calls these two endpoints today.

### Admin (role `admin`, enforced server-side)

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `/admin/stats` | **200** `{total_users, total_profiles, total_analyses}` | 401, 403 |
| GET | `/admin/users` | **200** `{id, email, full_name, role, created_at}[]` (<= 100, no credential data) | 401, 403 |

### Health

`GET /api/health` returns **200** `{status, service}`. Public.

## Who uses what

| Endpoint | Web | Extension |
|---|---|---|
| `/auth/register`, `/auth/login`, `/auth/me`, `/auth/logout` | yes | yes |
| `/auth/refresh` | yes (one automatic retry after a 401) | no (the refresh cookie is not available; a 401 returns the popup to login) |
| `/profile` | GET and PUT | PUT only, clamped by `toProfilePayload` |
| `/analysis` POST and `/analysis/latest` | yes | yes |
| `GET /analysis` list | helper exists, unused | no |
| `/market/*`, `/admin/*` | no (an admin-stats helper exists, unused) | no |

## Client configuration

| Client | Variable | Notes |
|---|---|---|
| Web | `NEXT_PUBLIC_API_URL` | Backend **origin**. Development falls back to `http://localhost:8000`; a production build without it fails loudly. |
| Extension | `VITE_API_URL`, `VITE_WEB_URL` | Development defaults `http://localhost:8000` and `http://localhost:3000`. A non-localhost API origin must also be added to `host_permissions` in `extension/public/manifest.json`. |

Both are bundled into public code. Provider keys (SerpApi, AI) and the JWT secret live only in the backend environment. The clients never call SerpApi or an AI provider.
