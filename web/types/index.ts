/**
 * Frontend mirror of the FastAPI response contract (backend/app/schemas).
 * Keep in sync with the backend; the dashboard never derives scores itself.
 */

export type UserRole = 'user' | 'admin';

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: UserRole | string;
  created_at: string;
  updated_at: string;
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

/** Body accepted by PUT /api/profile (ProfileCreate). */
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

/** Response of GET/PUT /api/profile (ProfileResponse). */
export interface Profile extends ProfileInput {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
}

// ─── Analysis ───

export type AnalysisStatus = 'pending' | 'searching' | 'analyzing' | 'completed' | 'failed';

/** One entry of Analysis.market_skills, keyed by canonical skill. */
export interface MarketSkill {
  canonical_skill?: string;
  display_name?: string;
  count: number;
  jobs_requiring?: number;
  /** Share (0-100) of the SAMPLED job listings mentioning the skill. */
  percentage: number;
}

export type MarketSkills = Record<string, MarketSkill>;

/** Entry of Analysis.strengths / Analysis.skill_gaps (deterministic). */
export interface SkillComparison {
  skill: string;
  canonical_skill?: string;
  display_name?: string;
  market_percentage: number;
  demand_percentage?: number;
  market_count?: number;
  jobs_requiring?: number;
  status?: 'strong' | 'missing';
  /** Gaps only: 1 = highest-demand missing skill. */
  priority_rank?: number;
}

export type RecommendationPriority = 'high' | 'medium' | 'low';

/** AI enrichment: Analysis.ai_recommendations. */
export interface AIRecommendation {
  action: string;
  reason: string;
  priority: RecommendationPriority;
}

/** AI enrichment: Analysis.ai_roadmap. */
export interface AIRoadmapItem {
  skill: string;
  priority: number;
  reasoning: string;
}

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

  // AI-derived contextual scores (may be null when AI is unavailable)
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

export interface AnalysisRequest {
  target_roles: string[];
  target_locations: string[];
}

export interface AdminStats {
  total_users: number;
  total_profiles: number;
  total_analyses: number;
}
