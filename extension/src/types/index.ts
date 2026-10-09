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
  /**
   * Read from the page when LinkedIn shows them. The backend's CertificationItem
   * schema has no such fields, so toProfilePayload() does not send them.
   */
  credential_id?: string;
  credential_url?: string;
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
  /**
   * Per section: entries extracted / section present but nothing readable / section
   * absent from the page / unknown because the page was not fully loaded.
   */
  sectionStatus?: Record<'about' | 'experience' | 'education' | 'certifications' | 'skills' | 'projects', SectionStatus>;
  /** Counts LinkedIn prints in section titles or links, e.g. "Skills (23)". Numbers only. */
  declaredCounts?: { skills?: number; certifications?: number };
  /** Whether LinkedIn offers a separate "Show all skills" page (never opened automatically). */
  skillsPage?: { linkPresent: boolean };
  /** Loading state when the page was read. */
  load?: {
    readyState: string;
    loadingIndicators: boolean;
    /** True when the page looked fully loaded and nothing was still changing. */
    complete: boolean;
    waitedMs?: number;
    evaluations?: number;
    timedOut?: boolean;
  };
}

/** What the extractor can say about one section of the page. */
export type SectionStatus =
  /** The section is on the page and entries were read from it. */
  | 'extracted'
  /** The section is on the page but no entries could be read from it. */
  | 'empty'
  /** The section is not on the page (the page looks fully loaded). */
  | 'absent'
  /** Unknown: the page was not fully loaded, so the section may simply not be rendered yet. */
  | 'unavailable';

/** Message the content scripts answer an EXTRACT_PROFILE request with. */
export type ExtractionResponse =
  | { success: true; profile: Profile; report: ExtractionReport }
  | { success: false; error: string };
