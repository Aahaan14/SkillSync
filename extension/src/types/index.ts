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

/**
 * Structure-only description of what an extractor found, shown in the popup and
 * copyable for bug reports. It deliberately contains counts and section titles,
 * never the profile's text content.
 */
export interface ExtractionReport {
  source: 'linkedin' | 'generic';
  found: { name: boolean; headline: boolean; location: boolean; about: boolean };
  counts: {
    skills: number;
    experience: number;
    education: number;
    certifications: number;
    projects: number;
  };
  /** Section headings recognised on the page (e.g. "Experience"). */
  sections: string[];
  /** Other section headings seen but not used (e.g. "Interests"). */
  otherHeadings: string[];
  warnings: string[];
  /** Which strategy supplied the data: HTML structure, plain page text, or both. */
  method?: 'structure' | 'text' | 'mixed';
  /** Shape of the page (counts only), to diagnose layout changes. */
  page?: { lines: number; h1: boolean; headings: number; listItems: number; ariaHidden: number };
}

/** Message the content scripts answer an EXTRACT_PROFILE request with. */
export type ExtractionResponse =
  | { success: true; profile: Profile; report: ExtractionReport }
  | { success: false; error: string };
