# Career Copilot Architecture

## Overview
Career Copilot is a **Career Intelligence Copilot** that analyzes a user's professional profile against current market demand using live web data (SerpApi) and AI.

## Architecture Components

### 1. Chrome Extension (Frontend Data Collection)
- **Role**: Extract user profile data directly from websites (e.g., LinkedIn) and present insights without leaving the context of the browser.
- **Tech**: React, TypeScript, Tailwind CSS, Chrome Manifest V3.
- **Security**: The extension **never** holds API keys (SerpApi, OpenAI, etc.). It communicates exclusively with the backend via REST API, using secure, HTTP-only cookies and Bearer tokens for authentication.

### 2. FastAPI Backend (Core Logic & Security)
- **Role**: Validates data, orchestrates market analysis, interacts with external APIs securely, and manages the database.
- **Tech**: Python, FastAPI, SQLAlchemy (Async), Pydantic.
- **Security**: 
  - Centralized authentication (JWT) and authorization (Role-Based Access Control).
  - Handles all external API communication securely.
  - Rate limiting (Redis) protects endpoints from abuse.
  - Implements prompt injection protection by treating all external job data as untrusted references.

### 3. PostgreSQL Database
- **Role**: Persistent storage of users, profiles, and analysis results.
- **Tech**: PostgreSQL 16.
- **Security**: 
  - All queries are parameterized via SQLAlchemy.
  - Strict ownership rules ensure a user can only query their own data (enforced at the DB query level using authenticated `user_id`).

### 4. Next.js Web Dashboard
- **Role**: Provides an in-depth view of the user's market alignment, skill gaps, and learning roadmap.
- **Tech**: Next.js, React, Tailwind CSS.

### 5. Services Layer (Backend)
- **SerpApi Service**: Handles job market searches. Implements deduplication, caching, and limits total queries per analysis (`SERPAPI_MAX_QUERIES_PER_ANALYSIS`) to control costs.
- **AI Service**: Abstracted provider (OpenAI, Gemini, Anthropic) that generates insights, strengths, gaps, and roadmaps based on a comparison between the user's profile and market sample.

## Core Analysis Pipeline Workflow
1. **Profile Extraction**: Extension extracts data from the page.
2. **API Request**: Extension sends profile data to the backend.
3. **Data Normalization**: Backend cleans and sanitizes the input.
4. **Market Queries**: Backend generates search queries dynamically based on the profile.
5. **Live Search**: Backend queries SerpApi (cached to reduce redundant calls).
6. **Data Processing**: Backend normalizes and deduplicates the search results.
7. **Skill Extraction**: Backend calculates the frequency/demand of skills within the sampled listings.
8. **Comparison**: User skills are compared against the market demand to find strengths and gaps.
9. **AI Insights**: AI analyzes the result to generate natural language insights and recommendations.
10. **Storage & Response**: Analysis is saved to the DB and returned to the extension/dashboard.

## Security Principles
- **No Secrets on Client**: API keys and database URLs live only on the backend.
- **Identity via Token**: The `user_id` is always derived from the verified JWT, never from user input or URL parameters.
- **Untrusted Input**: All input is sanitized via Pydantic; external webpage content is explicitly labeled as untrusted when passed to the LLM.
- **Secure Passwords**: Argon2id hashing is used for all passwords.
