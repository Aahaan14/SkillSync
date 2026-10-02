export interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
}

export interface Profile {
  id?: number;
  name?: string;
  headline?: string;
  about?: string;
  location?: string;
  profile_url?: string;
  skills: any[];
  experience: any[];
  education: any[];
  certifications: any[];
  projects: any[];
  source?: string;
}

export interface Analysis {
  id: number;
  status: string;
  jobs_analyzed_count: number;
  market_skills: Record<string, any>;
  strengths: any[];
  skill_gaps: any[];
  overall_alignment_score: number;
  skill_alignment: number;
  role_alignment: number;
  education_alignment: number;
  experience_alignment: number;
  ai_summary: string;
  ai_strengths: string[];
  ai_gaps: string[];
  ai_recommendations: any[];
  ai_relevant_roles: string[];
  ai_roadmap: any[];
  search_queries: string[];
  created_at: string;
}
