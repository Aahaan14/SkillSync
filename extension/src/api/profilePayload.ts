import type { Profile } from '../types';
import type {
  CertificationItem,
  EducationItem,
  ExperienceItem,
  ProfileInput,
  ProjectItem,
  SkillItem,
} from '../types/api';

/**
 * Limits enforced by the backend's ProfileCreate schema
 * (backend/app/schemas/__init__.py). Content scripts scrape arbitrary pages, so
 * their output is clamped to these before saving; otherwise one long page title
 * or an empty name turns "Analyze Current Page" into a 422.
 *
 * backend/tests/test_client_contract.py fails if any value here differs from
 * the backend, so edit both together.
 */
export const PROFILE_LIMITS = {
  name: 100,
  headline: 500,
  about: 10000,
  location: 200,
  profile_url: 2048,
  source: 50,
  skills: 200,
  experience: 50,
  education: 20,
  certifications: 50,
  projects: 50,
  skill_name: 100,
  experience_title: 200,
  experience_company: 200,
  experience_location: 200,
  experience_date: 50,
  experience_description: 5000,
  education_institution: 200,
  education_degree: 200,
  education_field: 200,
  education_date: 50,
  certification_name: 200,
  certification_issuer: 200,
  certification_date: 50,
  project_name: 200,
  project_description: 5000,
  project_url: 2048,
} as const;

/** Trim, turn empty/non-string into null, and cap the length. */
function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Same as text() but only http(s) URLs survive (the backend rejects other schemes). */
function httpUrl(value: unknown, max: number): string | null {
  const candidate = text(value, Number.MAX_SAFE_INTEGER);
  if (!candidate || candidate.length > max) return null;
  return /^https?:\/\//i.test(candidate) ? candidate : null;
}

function list<T>(value: unknown, max: number, map: (item: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const raw of value) {
    if (out.length >= max) break;
    if (raw && typeof raw === 'object') {
      const mapped = map(raw as Record<string, unknown>);
      if (mapped) out.push(mapped);
    }
  }
  return out;
}

/**
 * Convert what an extractor scraped into the exact body PUT /api/profile
 * accepts: empty strings become null, over-long text is truncated, list items
 * missing their required field are dropped, non-http(s) URLs are removed.
 */
export function toProfilePayload(draft: Profile): ProfileInput {
  const L = PROFILE_LIMITS;
  return {
    name: text(draft.name, L.name),
    headline: text(draft.headline, L.headline),
    about: text(draft.about, L.about),
    location: text(draft.location, L.location),
    profile_url: httpUrl(draft.profile_url, L.profile_url),
    source: text(draft.source, L.source),
    skills: list<SkillItem>(draft.skills, L.skills, (s) => {
      const name = text(s.name, L.skill_name);
      if (!name) return null;
      const endorsements =
        typeof s.endorsements === 'number' && Number.isInteger(s.endorsements) && s.endorsements >= 0
          ? s.endorsements
          : null;
      return { name, endorsements };
    }),
    experience: list<ExperienceItem>(draft.experience, L.experience, (e) => {
      const title = text(e.title, L.experience_title);
      if (!title) return null;
      return {
        title,
        company: text(e.company, L.experience_company),
        location: text(e.location, L.experience_location),
        start_date: text(e.start_date, L.experience_date),
        end_date: text(e.end_date, L.experience_date),
        description: text(e.description, L.experience_description),
      };
    }),
    education: list<EducationItem>(draft.education, L.education, (e) => {
      const institution = text(e.institution, L.education_institution);
      if (!institution) return null;
      return {
        institution,
        degree: text(e.degree, L.education_degree),
        field_of_study: text(e.field_of_study, L.education_field),
        start_date: text(e.start_date, L.education_date),
        end_date: text(e.end_date, L.education_date),
      };
    }),
    certifications: list<CertificationItem>(draft.certifications, L.certifications, (c) => {
      const name = text(c.name, L.certification_name);
      if (!name) return null;
      return {
        name,
        issuer: text(c.issuer, L.certification_issuer),
        date: text(c.date, L.certification_date),
      };
    }),
    projects: list<ProjectItem>(draft.projects, L.projects, (p) => {
      const name = text(p.name, L.project_name);
      if (!name) return null;
      return {
        name,
        description: text(p.description, L.project_description),
        url: httpUrl(p.url, L.project_url),
      };
    }),
  };
}
