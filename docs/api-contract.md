# API Contract

## Authentication

### `POST /api/auth/register`
- **Body**: `{ email, password, full_name? }`
- **Response**: `{ id, email, full_name, role, created_at, updated_at }`
- **Action**: Registers a user, hashes password, returns data. Sets HTTP-only cookies (`access_token`, `refresh_token`).

### `POST /api/auth/login`
- **Body**: `{ email, password }`
- **Response**: `{ id, email, full_name, role, created_at, updated_at }`
- **Action**: Logs in user. Sets HTTP-only cookies.

### `POST /api/auth/logout`
- **Response**: `{ message: "Logged out successfully" }`
- **Action**: Clears HTTP-only cookies.

### `POST /api/auth/refresh`
- **Response**: `{ access_token, token_type }` (Also sets new cookies)
- **Action**: Refreshes access token using the refresh token cookie.

### `GET /api/auth/me`
- **Headers**: Requires authentication (Cookie or Bearer).
- **Response**: User object.

## Profile

### `GET /api/profile`
- **Headers**: Requires authentication.
- **Response**: The authenticated user's profile object.

### `PUT /api/profile`
- **Headers**: Requires authentication.
- **Body**: `{ name, headline, about, location, profile_url, skills, experience, education, certifications, projects, source }`
- **Response**: The updated profile object.

## Analysis

### `POST /api/analysis`
- **Headers**: Requires authentication.
- **Body**: `{ target_roles: [], target_locations: [] }`
- **Response**: `{ id, status, jobs_analyzed_count, market_skills, strengths, skill_gaps, overall_alignment_score, ai_summary, ai_recommendations, ... }`
- **Action**: Triggers the entire SerpApi and AI analysis pipeline.

### `GET /api/analysis/latest`
- **Headers**: Requires authentication.
- **Response**: The most recent analysis object for the user.

### `GET /api/analysis/{id}`
- **Headers**: Requires authentication.
- **Response**: A specific analysis object (enforces ownership).

### `GET /api/analysis`
- **Headers**: Requires authentication.
- **Response**: `[ AnalysisObject, ... ]` (List of user's past analyses).

## Market

### `POST /api/market/search`
- **Headers**: Requires authentication.
- **Body**: `{ query, location, num_results }`
- **Response**: `{ query, jobs: [...], total_results, cached }`
- **Action**: Direct query to SerpApi (rate limited).

### `GET /api/market/skills`
- **Headers**: Requires authentication.
- **Response**: `{ market_skills, jobs_analyzed_count, analysis_date }`
- **Action**: Returns aggregate market skills from the latest analysis.

## Admin

### `GET /api/admin/stats`
- **Headers**: Requires authentication, User Role = `ADMIN`.
- **Response**: `{ total_users, total_profiles, total_analyses }`

### `GET /api/admin/users`
- **Headers**: Requires authentication, User Role = `ADMIN`.
- **Response**: `[ { id, email, full_name, role, created_at }, ... ]`
