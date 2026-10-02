# Career Copilot Demo Flow

This document outlines the end-to-end flow to demonstrate Career Copilot's capabilities.

## 1. Setup
1. Clone the repository and copy `.env.example` to `.env`.
2. Fill in the required API keys (SerpApi, OpenAI/Gemini/Anthropic).
3. Start the backend services using `docker-compose up -d db redis backend`.
4. Load the unpacked Chrome extension into the browser.
5. Start the web dashboard using `npm run dev`.

## 2. Authentication
1. Open the Chrome extension popup.
2. Click **Register** and create a new account.
3. Log in. (The JWT is securely stored in HTTP-only cookies).

## 3. Data Extraction
1. Navigate to a professional profile (e.g., your own LinkedIn profile).
2. Open the Career Copilot extension.
3. The extension content script runs automatically, extracting your headline, skills, experience, and education.
4. Review the extracted data in the popup.
5. Click **"Save Profile"** to securely send it to the backend.

## 4. Market Intelligence Analysis
1. In the extension (or dashboard), click **"Analyze My Profile"**.
2. **Backend Process (Observable in logs):**
   - Generates targeted job market search queries based on your profile.
   - Securely queries SerpApi for current job listings (Google Jobs).
   - Normalizes and deduplicates the retrieved listings.
   - Extracts top skills from the market data and calculates demand percentages.
   - Compares your skills against the market to find strengths and gaps.
   - Sends the data (isolated from system prompts) to the AI provider to generate insights.
3. **Results Display:**
   - The extension UI updates to show your overall Market Alignment Score.
   - View your **Strengths** (skills you have that are in demand).
   - View your **High-Demand Gaps** (skills you lack that the market wants).

## 5. Web Dashboard Deep Dive
1. Click **"View Full Analysis"** to open the Next.js dashboard.
2. Navigate through the detailed breakdown:
   - **Market Context**: See the specific job listings used to generate the analysis (providing transparency).
   - **AI Recommendations**: Read personalized advice on how to improve your profile.
   - **Roadmap**: View the suggested learning path to close your skill gaps.

## 6. Profile Simulator (Stretch Goal)
1. In the dashboard, add a "Gap" skill to your profile.
2. Click **"Simulate Impact"**.
3. Watch the alignment score recalculate based on the new skill profile, demonstrating the value of learning that specific skill.
