import type { ExtractionReport, Profile } from '../types';

/**
 * Decide whether an extracted profile is worth saving.
 *
 * The backend builds its job searches from the headline, the target roles and
 * the latest job title, so a profile with none of those cannot be analysed at
 * all. Saving it anyway would replace the user's stored profile with an empty
 * one and then fail. Block it up front instead.
 */

export interface ProfileAssessment {
  /** True when the backend has enough to build market queries. */
  canAnalyze: boolean;
  /** Why it cannot be analysed (shown to the user). */
  blockingReason?: string;
  /** Non-blocking issues worth surfacing after the analysis. */
  warnings: string[];
}

export function assessProfile(profile: Profile, report?: ExtractionReport): ProfileAssessment {
  const hasHeadline = !!profile.headline?.trim();
  const hasRole = profile.experience.some((e) => !!e.title?.trim());
  const warnings: string[] = [];

  if (!hasHeadline && !hasRole) {
    // What the reader saw, so a failure is diagnosable without developer tools.
    const saw = report?.page
      ? ` (It read ${report.page.lines} lines of text and recognised ${report.sections.length} profile sections.)`
      : '';
    return {
      canAnalyze: false,
      blockingReason:
        (profile.source === 'linkedin'
          ? "SkillSync couldn't read a headline or any job titles from this LinkedIn page. Scroll down so the page finishes loading, then try again. If it keeps happening, LinkedIn may have changed its layout."
          : "SkillSync couldn't find a job title or headline on this page.") + saw,
      warnings,
    };
  }

  if (profile.skills.length === 0) {
    warnings.push(
      'No skills were found on the page. The market comparison is based on your listed skills, so add them on the dashboard Profile page for a meaningful score.',
    );
  }
  if (report) {
    for (const w of report.warnings) {
      if (!warnings.includes(w) && !/no skills were found/i.test(w)) warnings.push(w);
    }
  }
  return { canAnalyze: true, warnings };
}

/** "14 skills · 3 roles · 1 education" - what was actually saved. */
export function summarizeProfile(profile: Profile): string {
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const parts = [
    plural(profile.skills.length, 'skill'),
    plural(profile.experience.length, 'role'),
    `${profile.education.length} education`,
  ];
  if (profile.certifications.length) parts.push(plural(profile.certifications.length, 'certification'));
  return parts.join(' · ');
}
