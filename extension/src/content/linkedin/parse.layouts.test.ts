// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { toProfilePayload } from '../../api/profilePayload';
import { assessProfile } from '../../api/profileQuality';
import { parseLinkedInProfile } from './parse';
import { headingCount, kindOf, stripCount } from './shared';
import { parseFromLines } from './textParse';
import { DISPLAY_CONTENTS_PAGE, EMPTY_SECTIONS_PAGE, MINIMAL_COMPLETE_PAGE, PARTIAL_LOAD_PAGE, SDUI_PAGE } from './__fixtures__/profiles';

const URL = 'https://www.linkedin.com/in/riya-shah/';

function parse(html: string) {
  return parseLinkedInProfile(new DOMParser().parseFromString(html, 'text/html'), URL);
}

describe('section titles', () => {
  it('recognise a trailing count such as "Skills (23)"', () => {
    expect(kindOf('Skills (23)')).toBe('skills');
    expect(kindOf('Licenses & certifications (9)')).toBe('certifications');
    expect(kindOf('Certifications')).toBe('certifications');
    expect(stripCount('Show all 9 licenses →')).toBe('Show all 9 licenses');
    expect(headingCount('Skills (23)')).toBe(23);
    expect(headingCount('Skills')).toBeUndefined();
  });
  it('do not treat navigation or sidebar headings as sections', () => {
    for (const title of ['Navigation', 'Activity', 'Interests', 'People you may know', 'Explore Premium profiles', 'Ad Options', 'You might like']) {
      expect(kindOf(title)).toBeNull();
    }
  });
});

describe('LinkedIn parser: name as a heading, div entries, counted Skills title (layout from the bug report)', () => {
  const { profile, report } = parse(SDUI_PAGE);

  it('reads headline and location even though the page has no <h1>', () => {
    expect(report.page?.h1).toBe(false);
    expect(profile.name).toBe('Riya Shah');
    expect(profile.headline).toBe('Data Analyst | SQL, Python and dashboards');
    expect(profile.location).toBe('Mumbai, Maharashtra, India');
    expect(report.found).toEqual({ name: true, headline: true, location: true, about: true });
  });

  it('reads several experience entries without <li> markup', () => {
    expect(profile.experience.map((e) => e.title)).toEqual(['Data Analyst', 'Analytics Intern', 'Freelance Researcher']);
    expect(profile.experience[0]).toMatchObject({
      company: 'Orbit Retail',
      start_date: 'Mar 2024',
      end_date: 'Present',
      location: 'Mumbai, Maharashtra, India · Hybrid',
    });
    expect(profile.experience[0].description).toMatch(/weekly sales dashboards/);
    expect(profile.experience[1]).toMatchObject({ company: 'Orbit Retail', start_date: 'Jun 2023', end_date: 'Feb 2024' });
  });

  it('keeps a role that is missing its company or description', () => {
    expect(profile.experience[2].title).toBe('Freelance Researcher');
    expect(profile.experience[2].description).toBeUndefined();
  });

  it('reads education, including an entry with no degree', () => {
    expect(profile.education).toEqual([
      { institution: 'University of Mumbai', degree: 'Bachelor of Science - BSc', field_of_study: 'Statistics', start_date: '2019', end_date: '2022' },
      { institution: 'St. Xavier’s College', start_date: '2017', end_date: '2019' },
    ]);
  });

  it('reads certifications with credential id and credential URL when present', () => {
    expect(profile.certifications).toEqual([
      {
        name: 'Google Data Analytics Professional Certificate',
        issuer: 'Coursera',
        date: 'Jan 2024',
        credential_id: 'ABC123XYZ',
        credential_url: 'https://www.coursera.org/verify/ABC123XYZ',
      },
      { name: 'SQL Fundamentals', issuer: 'DataCamp', date: 'Aug 2023' },
    ]);
  });

  it('reads the skills visible on the page and says the rest are on the skills page', () => {
    expect(report.sections).toContain('skills');
    expect(profile.skills.map((s) => s.name)).toEqual(expect.arrayContaining(['SQL', 'Power BI']));
    expect(profile.skills.some((s) => /show all/i.test(s.name))).toBe(false);
    expect(report.declaredCounts?.skills).toBe(23);
    expect(report.skillsPage?.linkPresent).toBe(true);
    expect(report.warnings.join(' ')).toMatch(/Only \d+ of 23 skills are visible/);
  });

  it('never fabricates skills it cannot see', () => {
    expect(profile.skills.length).toBeLessThan(23);
  });

  it('does not read sidebar, navigation or other headings as profile data', () => {
    const json = JSON.stringify(profile);
    expect(json).not.toMatch(/Aman Verma|Experience Designer|Navigation|Premium|Ad Options|Top Voices/);
    expect(report.otherHeadings).toEqual(expect.arrayContaining(['Activity', 'Interests', 'People you may know']));
    expect(report.otherHeadings).not.toContain('Riya Shah'); // the person's own name is not a section title
    expect(JSON.stringify(report)).not.toMatch(/Riya|Orbit|Coursera|ABC123XYZ/);
  });

  it('reports each section as extracted', () => {
    expect(report.sectionStatus).toEqual({
      about: 'extracted',
      experience: 'extracted',
      education: 'extracted',
      certifications: 'extracted',
      skills: 'extracted',
      projects: 'absent',
    });
    expect(report.load?.complete).toBe(true);
  });

  it('is analysable and the payload drops fields the backend does not accept', () => {
    expect(assessProfile(profile, report).canAnalyze).toBe(true);
    const payload = toProfilePayload(profile);
    expect(payload.certifications).toEqual([
      { name: 'Google Data Analytics Professional Certificate', issuer: 'Coursera', date: 'Jan 2024' },
      { name: 'SQL Fundamentals', issuer: 'DataCamp', date: 'Aug 2023' },
    ]);
    expect(JSON.stringify(payload)).not.toMatch(/credential/i);
  });
});

describe('LinkedIn parser: section status', () => {
  it('partial loading: lower sections are "unavailable", not "absent", and the user is told to wait', () => {
    const { profile, report } = parse(PARTIAL_LOAD_PAGE);
    expect(profile.about).toMatch(/dashboards/);
    expect(report.load?.loadingIndicators).toBe(true);
    expect(report.load?.complete).toBe(false);
    expect(report.sectionStatus).toMatchObject({
      about: 'extracted',
      experience: 'unavailable',
      education: 'unavailable',
      certifications: 'unavailable',
      skills: 'unavailable',
    });
    expect(report.warnings.join(' ')).toMatch(/still loading/i);
  });

  it('section found but no entries: "empty", with a warning that names the section', () => {
    const { report } = parse(EMPTY_SECTIONS_PAGE);
    expect(report.sectionStatus).toMatchObject({ about: 'extracted', experience: 'empty', education: 'empty' });
    expect(report.warnings).toContain('The Experience section was found but no roles could be read.');
    expect(report.warnings).toContain('The Education section was found but no entries could be read.');
  });

  it('finished page without a section: "absent", with no loading warning', () => {
    const { profile, report } = parse(MINIMAL_COMPLETE_PAGE);
    expect(profile.education).toHaveLength(1);
    expect(report.sectionStatus).toMatchObject({
      about: 'extracted',
      education: 'extracted',
      experience: 'absent',
      certifications: 'absent',
      skills: 'absent',
      projects: 'absent',
    });
    expect(report.warnings.join(' ')).not.toMatch(/still loading/i);
  });

  it('no sections at all: everything is "unavailable" rather than claimed absent', () => {
    const { report } = parse('<html><head><title>Riya Shah | LinkedIn</title></head><body><main><h2>Riya Shah</h2><p>Data Analyst</p></main></body></html>');
    expect(Object.values(report.sectionStatus!).every((s) => s === 'unavailable')).toBe(true);
    expect(report.warnings.join(' ')).toMatch(/No profile sections/);
  });
});

describe('text parser: job titles that start with a section-like word', () => {
  it('keeps "Analytics Intern" and "Services Engineer" as roles instead of ending Experience there', () => {
    const lines = [
      'Riya Shah', 'Data Analyst', 'Mumbai, Maharashtra, India',
      'Experience',
      'Analytics Intern', 'Orbit Retail · Internship', 'Jun 2023 - Feb 2024 · 9 mos',
      'Services Engineer', 'Nimbus Cloud · Full-time', 'Mar 2024 - Present · 1 yr 7 mos',
      'Education',
      'University of Mumbai', 'Bachelor of Science - BSc, Statistics', '2019 – 2022',
      'Analytics', 'Activity',
    ];
    const parsed = parseFromLines(lines, 'Riya Shah');
    expect(parsed.experience.map((e) => e.title)).toEqual(['Analytics Intern', 'Services Engineer']);
    expect(parsed.education).toHaveLength(1);
  });
});

describe('LinkedIn parser: display:contents wrappers and hidden copies', () => {
  const { profile, report } = parse(DISPLAY_CONTENTS_PAGE);

  it('keeps the top card that sits inside display:contents wrappers', () => {
    expect(profile.name).toBe('Jeel Nandha');
    expect(profile.headline).toBe('AI/ML Builder | Researcher | Security');
    expect(profile.location).toBe('Ahmedabad, Gujarat, India');
  });

  it('keeps roles inside display:contents wrappers', () => {
    expect(profile.experience.map((e) => e.title)).toEqual(['Machine Learning Engineer']);
  });

  it('still skips a display:none copy', () => {
    expect(JSON.stringify(profile)).not.toMatch(/Stale mobile headline/);
    expect(report.sectionStatus?.experience).toBe('extracted');
  });
});
