/**
 * Extension mirror of the SkillSync backend response contract.
 *
 * Source of truth: docs/openapi.json (generated from the Pydantic models by
 * backend/scripts/export_openapi.py). Optional backend fields are `T | null`
 * on the wire, never missing. backend/tests/test_client_contract.py fails if a
 * field name here drifts from the backend schema.
 *
 * The extension talks ONLY to the SkillSync backend; it never calls SerpApi or
 * an AI provider, and it never computes scores: overall_alignment_score and
 * skill_alignment are deterministic and authoritative.
 */

export type UserRole = 'user' | 'admin';

/** POST /auth/login, POST /auth/register, GET /auth/me (UserResponse). */
export interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
  /**
   * Bearer token for this extension. Present on login/register only (null on
   * /auth/me). Persisted in chrome.storage.local because HTTP-only cookies are
   * not sent from chrome-extension:// pages to localhost.
   */
  access_token: string | null;
}

// ─── Profile ───

export interface SkillItem {
  name: string;
  endorsements?: number | null;
}

export interface ExperienceItem {
  title: string;
  company?: string | null;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
}

export interface EducationItem {
  institution: string;
  degree?: string | null;
  field_of_study?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface CertificationItem {
  name: string;
  issuer?: string | null;
  date?: string | null;
}

export interface ProjectItem {
  name: string;
  description?: string | null;
  url?: string | null;
}

/** Body of PUT /profile (ProfileCreate). Build it with toProfilePayload(). */
export interface ProfileInput {
  name: string | null;
  headline: string | null;
  about: string | null;
  location: string | null;
  profile_url: string | null;
  skills: SkillItem[];
  experience: ExperienceItem[];
  education: EducationItem[];
  certifications: CertificationItem[];
  projects: ProjectItem[];
  source: string | null;
}

/** Response of GET/PUT /profile (ProfileResponse). */
export interface ApiProfile extends ProfileInput {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
}

// ─── Analysis ───

export type AnalysisStatus = 'pending' | 'searching' | 'analyzing' | 'completed' | 'failed';

/** One value of Analysis.market_skills (keyed by canonical skill). Deterministic. */
export interface MarketSkill {
  canonical_skill?: string | null;
  display_name?: string | null;
  count: number;
  jobs_requiring?: number | null;
  /** Share (0-100) of the SAMPLED job listings mentioning the skill. */
  percentage: number;
}

export type MarketSkills = Record<string, MarketSkill>;

/** Entry of Analysis.strengths / Analysis.skill_gaps. Deterministic. */
export interface SkillComparison {
  skill: string;
  canonical_skill?: string | null;
  display_name?: string | null;
  market_percentage: number;
  demand_percentage?: number | null;
  market_count?: number | null;
  jobs_requiring?: number | null;
  status?: 'strong' | 'missing' | null;
  /** Gaps only: 1 = highest-demand missing skill. null on strengths. */
  priority_rank?: number | null;
}

/** AI enrichment only. */
export interface AIRecommendation {
  action: string;
  reason?: string | null;
  priority?: string | null;
}

/** AI enrichment only. */
export interface AIRoadmapItem {
  skill: string;
  priority?: number | null;
  reasoning?: string | null;
}

/** POST /analysis, GET /analysis/latest, GET /analysis/{id} (AnalysisResponse). */
export interface Analysis {
  id: number;
  status: AnalysisStatus;
  jobs_analyzed_count: number;

  // Deterministic (authoritative)
  market_skills: MarketSkills | null;
  strengths: SkillComparison[] | null;
  skill_gaps: SkillComparison[] | null;
  overall_alignment_score: number | null;
  skill_alignment: number | null;
  search_queries: string[] | null;

  // AI-derived contextual scores (null when the AI is unavailable)
  role_alignment: number | null;
  education_alignment: number | null;
  experience_alignment: number | null;

  // AI enrichment (optional)
  ai_summary: string | null;
  ai_strengths: string[] | null;
  ai_gaps: string[] | null;
  ai_recommendations: AIRecommendation[] | null;
  ai_relevant_roles: string[] | null;
  ai_roadmap: AIRoadmapItem[] | null;

  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/** Body of POST /analysis (AnalysisRequest). */
export interface AnalysisRequest {
  target_roles: string[];
  target_locations: string[];
}
