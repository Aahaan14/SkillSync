# SkillSync — Setup Guide

SkillSync is a Career Intelligence Copilot prototype. It reads professional profile information through a Chrome extension, searches job-market listings through SerpApi, calculates market skill demand and profile alignment, and presents analysis in a web dashboard with optional AI-generated recommendations.

This guide covers local development on Windows using PowerShell. The repository contains three main parts:

- `backend/` — FastAPI API and analysis pipeline
- `extension/` — Chrome Manifest V3 extension
- `web/` — Next.js dashboard

## 1. Prerequisites

Install these tools before starting:

- **Git** (if cloning the repository)
- **Python 3.12**
- **Node.js** compatible with the versions in the project package files, plus npm
- **Docker Desktop** (recommended for PostgreSQL and Redis)
- **Google Chrome**
- API credentials for **SerpApi** and, if AI recommendations are to be enabled, one supported AI provider

Confirm the installations in PowerShell:

```powershell
python --version
node --version
npm --version
docker --version
docker compose version
```

Python should report version 3.12.x. Docker is only needed for the container-based database/cache setup described below.

## 2. Extract the project

Extract the submitted ZIP, then open PowerShell in the project root—the folder containing `.env.example`, `docker-compose.yml`, `backend`, `extension`, and `web`.

For example:

```powershell
cd "C:\path\to\SkillSync-main"
```

Do not run the following commands from inside `backend`, `extension`, or `web` unless the step specifically tells you to change folders.

## 3. Configure environment variables

Create a local environment file from the template:

```powershell
Copy-Item .env.example .env
```

Open `.env` and configure the required values:

```dotenv
SERPAPI_API_KEY=your_serpapi_key
AI_PROVIDER=grok
GROK_API_KEY=your_grok_api_key
JWT_SECRET=replace_with_a_long_random_secret
JWT_REFRESH_SECRET=replace_with_a_different_long_random_secret
```

- Obtain a SerpApi key from SerpApi. It is used by the backend to retrieve job listings.
- Choose the AI provider you intend to use: `grok`, `openai`, `gemini`, or `anthropic`, and supply that provider's API key. For example, if using OpenAI, set `AI_PROVIDER=openai` and fill `OPENAI_API_KEY` instead of `GROK_API_KEY`.
- Generate unique, unpredictable values for both JWT secrets. Do not use the example values for a shared or deployed environment.
- Keep `.env` private. Do not commit API keys or secrets to Git or place them in frontend/extension environment variables.

The repository's `.env.example` uses PostgreSQL and Redis URLs for local Docker services. The Compose file supplies the container-specific database and Redis addresses to the backend.

### Optional: extension and dashboard URLs

The extension and dashboard have their own templates:

```powershell
Copy-Item extension\.env.example extension\.env.local
Copy-Item web\.env.example web\.env.local
```

Defaults are intended for local use:

- Backend: `http://localhost:8000`
- Web dashboard: `http://localhost:3000`

`VITE_API_URL` and `NEXT_PUBLIC_API_URL` are public frontend configuration, not places for secret keys. If you change the backend origin, update the matching frontend value and the extension's `host_permissions` in `extension/public/manifest.json`.

## 4. Start the backend dependencies and API

From the project root, start PostgreSQL, Redis, and the FastAPI backend:

```powershell
docker compose up -d --build db redis backend
```

Check container status:

```powershell
docker compose ps
```

View backend logs if startup fails:

```powershell
docker compose logs -f backend
```

The API should be available at `http://localhost:8000`. Check the health endpoint:

```powershell
Invoke-RestMethod http://localhost:8000/api/health
```

Expected response:

```json
{
  "status": "healthy",
  "service": "career-copilot"
}
```

The OpenAPI schema is available at `http://localhost:8000/openapi.json`. A Swagger UI page may not be enabled in this prototype configuration.

### Database migrations

The backend includes Alembic migrations. If you need to apply migrations manually, open a second PowerShell window and run:

```powershell
docker compose exec backend alembic upgrade head
```

If the backend image or container is not running, start the services first. Do not delete the database volume to troubleshoot ordinary startup issues; doing so can erase local data.

## 5. Start the web dashboard

Open a separate PowerShell window:

```powershell
cd "C:\path\to\SkillSync-main\web"
Copy-Item .env.example .env.local
npm install
npm run dev
```

If `.env.local` already exists, do not overwrite it unless you intend to reset the local configuration.

Open:

**http://localhost:3000**

To create a production build:

```powershell
npm run build
```

## 6. Build and load the Chrome extension

Open another PowerShell window:

```powershell
cd "C:\path\to\SkillSync-main\extension"
Copy-Item .env.example .env.local
npm install
npm test
npm run build
```

If `.env.local` already exists, preserve it and edit it only if configuration needs to change. A successful build creates the `dist/` output.

Then load the extension into Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the project's **`extension` folder** (the folder containing `public/manifest.json`), as configured by the Vite build.
5. If the extension is already loaded, click **Reload** after rebuilding.
6. Open a LinkedIn profile page and refresh it before testing extraction.

Do not select the `dist` folder unless the project build specifically places a manifest there; this project's documented setup uses the `extension` folder.

## 7. Run a prototype demonstration

1. Open `http://localhost:3000`.
2. Register a test account or sign in.
3. Open a LinkedIn profile that you are authorized to access.
4. Open the SkillSync extension and review the extracted profile fields.
5. Save the profile.
6. Start an analysis.
7. Review the market alignment score, recognized market skills, strengths, skill gaps, and AI recommendations in the extension/dashboard.

### LinkedIn extraction notes

- LinkedIn may only show a subset of a person's skills on the main profile page.
- If the extension offers **Open full skills list**, open that page and use the extension's option to add skills from it. Scroll to the bottom first so LinkedIn has a chance to load the full list.
- Extraction depends on LinkedIn's current page markup and what the signed-in account can see. Verify the extracted fields against the page before interpreting the analysis.
- Use your own profile, a test profile, or a profile you have permission to use. Avoid collecting or sharing other people's personal information without authorization.

## 8. How to interpret the results

SkillSync compares the skills in a profile with skills found in the job listings returned for the analysis queries.

- **Market demand** represents how often a recognized skill appears in the sampled job listings.
- **Matched skills** are recognized market skills that overlap with the saved profile.
- **Skill gaps** are recognized market skills that were not found in the saved profile.
- **Market alignment score** summarizes overlap with the sampled market demand.

The score is an indicator of alignment to the sampled job-market data. It is **not** a probability of getting hired, passing an interview, or receiving a particular salary. Results depend on profile extraction, search terms, job-listing availability, and the skills recognized by the pipeline.

## 9. Troubleshooting

### Backend does not start

```powershell
docker compose ps
docker compose logs -f backend
docker compose logs -f db
docker compose logs -f redis
```

Check that Docker Desktop is running, required ports are available, and `.env` contains valid configuration.

### Dashboard cannot reach the API

- Confirm the backend health endpoint works: `http://localhost:8000/api/health`.
- Confirm `web/.env.local` contains `NEXT_PUBLIC_API_URL=http://localhost:8000`.
- Restart the Next.js development server after changing `.env.local`.

### Extension cannot connect to the API

- Confirm `extension/.env.local` contains `VITE_API_URL=http://localhost:8000`.
- Rebuild with `npm run build` after changing Vite environment values.
- Check that the backend is running and that the API origin is allowed by the extension manifest.
- Reload the extension at `chrome://extensions` and refresh the LinkedIn tab.

### No headline, job titles, or skills are extracted

- Ensure you are on a LinkedIn profile URL such as `/in/<profile>/`, not a separate details page.
- Wait for the page to finish loading, then refresh and try again.
- Open the full skills list if LinkedIn reports that some skills are missing.
- Use the extension's diagnostic details to see which sections were detected. The diagnostic output is intended to report section/count information, not the full profile text.

### Analysis returns no jobs or few skills

Search results depend on the profile's role/headline, the configured SerpApi key, and current search results. Check backend logs for provider/configuration errors. A zero-job result can occur and does not necessarily mean the backend is broken.

### AI recommendations are missing

Check that `AI_PROVIDER` matches the provider whose API key is configured, that the key is valid, and that the provider account can make requests. The deterministic market analysis can still be useful when AI enrichment is unavailable.

## 10. Run checks before submission

From the project root, the backend tests can be run in the configured Python environment. For a local Python setup, for example:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pytest tests -v
```

For a Docker-based setup, use the backend container:

```powershell
docker compose exec backend pytest tests -v
```

Extension checks:

```powershell
cd ..\extension
npm test
npm run build
```

Dashboard checks:

```powershell
cd ..\web
npm install
npm run lint
npm run build
```

If a check fails, record the exact command and error rather than reporting the check as passed.

## 11. Stop local services

From the project root:

```powershell
docker compose down
```

This stops the containers but keeps the database volume. To remove volumes as well, Docker Compose supports `docker compose down -v`, but **this deletes local database/cache data** and should only be used when you intentionally want a reset.

---

**Prototype note:** This guide describes local setup and demonstration. A production deployment requires production-grade secrets, HTTPS, provider/account configuration, backups, and deployment-specific CORS/cookie settings.
