# SkillSync

Career Copilot is a production-quality MVP of a **Career Intelligence Copilot**. It helps job seekers understand the gap between their current profile and evolving job market expectations.

It works by extracting a user's professional profile (via a Chrome Extension), dynamically searching the live job market using **SerpApi**, calculating skill demand, and providing AI-driven personalized recommendations.

## Tech Stack
- **Extension**: React, TypeScript, Tailwind CSS, Chrome Manifest V3
- **Backend**: Python, FastAPI, SQLAlchemy, PostgreSQL, Redis
- **Web App**: Next.js, React, Tailwind CSS
- **APIs**: SerpApi (Market Data), OpenAI / Gemini / Anthropic (AI Insights)

## Architecture & Security
Security is a first-class requirement:
- **No Secrets on Client**: The Chrome extension never holds API keys. All external requests (SerpApi, AI) are routed through the FastAPI backend.
- **Authentication**: JWT with HTTP-Only cookies. Passwords hashed using Argon2id.
- **Authorization**: Strict Row-Level-Security style ownership checks in FastAPI ensure users can only access their own data.
- **Prompt Injection Protection**: External job descriptions are strictly separated from AI system prompts and treated as untrusted data.

For more details, see [docs/architecture.md](docs/architecture.md) and [docs/api-contract.md](docs/api-contract.md).

## Local Development Setup

### 1. Environment Configuration
Do NOT commit your `.env` file. A template is provided:
```bash
cp .env.example .env
```
Fill in the following essential variables in `.env`:
- `SERPAPI_API_KEY`
- `AI_PROVIDER` (e.g., openai)
- `OPENAI_API_KEY` (or the key for your chosen provider)
- `JWT_SECRET` (generate a random string)
- `JWT_REFRESH_SECRET` (generate a random string)

### 2. Backend (Docker)
The easiest way to run the backend, database, and Redis is via Docker Compose:
```bash
docker-compose up -d db redis backend
```
The backend API will be available at `http://localhost:8000`.
API Documentation (Swagger) is available at `http://localhost:8000/api/docs`.

### 3. Database Migrations
Migrations are managed with Alembic. (Detailed in Phase 3).

### 4. Chrome Extension
(Instructions to be added in Phase 4).

### 5. Web Dashboard
(Instructions to be added in Phase 9).

## Development Phases
This project is built in structured phases. See the project prompt for the exact definitions of phases 1 through 12.

1. **Architecture** (Completed)
2. **Authentication**
3. **Database**
4. **Chrome Extension**
5. **Backend Integration**
6. **SerpApi**
7. **Market Intelligence**
8. **AI**
9. **UI**
10. **Security Audit**
11. **Testing**
12. **Demo**
