export interface Profile {
  name?: string;
  headline?: string;
  about?: string;
  location?: string;
  profile_url?: string;
  skills: SkillItem[];
  experience: ExperienceItem[];
  education: EducationItem[];
  certifications: CertificationItem[];
  projects: ProjectItem[];
  source: string;
}

export interface SkillItem {
  name: string;
  endorsements?: number;
}

export interface ExperienceItem {
  title: string;
  company?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
}

export interface EducationItem {
  institution: string;
  degree?: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
}

export interface CertificationItem {
  name: string;
  issuer?: string;
  date?: string;
}

export interface ProjectItem {
  name: string;
  description?: string;
  url?: string;
}

export interface ProfileExtractor {
  extractProfile(): Promise<Profile>;
}
