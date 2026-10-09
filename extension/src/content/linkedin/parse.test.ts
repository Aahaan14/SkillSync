// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { assessProfile } from '../../api/profileQuality';
import { toProfilePayload } from '../../api/profilePayload';
import { parseLinkedInProfile } from './parse';
import { CLASSIC_PAGE, CLASSLESS_PAGE, TEXT_ONLY_PAGE, TOP_CARD_ONLY_PAGE, UNKNOWN_PAGE } from './__fixtures__/profiles';
import { collapseDoubled, collectLines } from './lines';

const URL = 'https://www.linkedin.com/in/jane-doe/';

function parse(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return parseLinkedInProfile(doc, URL);
}

describe.each([
  ['classic markup (ids + pvs classes)', CLASSIC_PAGE],
  ['class-less markup (headings only)', CLASSLESS_PAGE],
])('LinkedIn parser: %s', (_label, html) => {
  const { profile, report } = parse(html);

  it('reads the top card', () => {
    expect(profile.name).toBe('Jane Doe');
    expect(profile.headline).toBe('Senior Product Designer, Fintech | Building clear interfaces');
    expect(profile.location).toBe('Pune, Maharashtra, India');
    expect(profile.source).toBe('linkedin');
    expect(profile.profile_url).toBe(URL);
  });

  it('reads the about section without the heading or "see more"', () => {
    expect(profile.about).toBe(
      'I design calm, accessible interfaces for financial products and mentor junior designers.',
    );
  });

  it('reads single and grouped roles', () => {
    expect(profile.experience.map((e) => e.title)).toEqual([
      'Senior Product Designer',
      'Graphic Designer',
      'Junior Designer',
    ]);
    const [single, grouped, nestedNoDescription] = profile.experience;
    expect(single).toMatchObject({
      company: 'Acme Payments',
      start_date: 'Jan 2022',
      end_date: 'Present',
      location: 'Pune, Maharashtra, India · On-site',
    });
    expect(single.description).toMatch(/merchant dashboard/);
    // Roles grouped under one company inherit the company line.
    expect(grouped).toMatchObject({ company: 'Mind Ventures International', start_date: 'Feb 2021', end_date: 'Feb 2022' });
    expect(nestedNoDescription).toMatchObject({
      company: 'Mind Ventures International',
      location: 'Pune/Pimpri-Chinchwad Area',
    });
  });

  it('reads education with degree and field split', () => {
    expect(profile.education).toEqual([
      {
        institution: 'Pune Institute of Computer Technology',
        degree: 'Bachelor of Engineering (B.E.)',
        field_of_study: 'Information Technology',
        start_date: '2013',
        end_date: '2017',
      },
    ]);
  });

  it('reads certifications without credential ids', () => {
    expect(profile.certifications).toEqual([
      { name: 'Protopie 101 Crash Course', issuer: 'ProtoPie', date: 'Jul 2025' },
      { name: 'Google UX Design Certificate', issuer: 'Coursera', date: 'Mar 2023' },
    ]);
  });

  it('merges the skills section with skills named on experience lines, once each', () => {
    const names = profile.skills.map((s) => s.name);
    // Skills section first (with endorsements), then inline skills, no duplicates.
    expect(names.slice(0, 3)).toEqual(['Figma', 'UX Design', 'Design Systems']);
    expect(names).toEqual(
      expect.arrayContaining(['Graphic Design', 'Adobe Illustrator', 'Adobe Photoshop', 'After Effects']),
    );
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
    expect(profile.skills[0].endorsements).toBe(12);
    // "+3 skills" is a count, never a skill.
    expect(names.some((n) => /\+\d/.test(n) || /skills?$/i.test(n))).toBe(false);
  });

  it('describes what it found without including profile text', () => {
    expect(report.counts).toEqual({ skills: 7, experience: 3, education: 1, certifications: 2, projects: 0 });
    expect(report.found).toEqual({ name: true, headline: true, location: true, about: true });
    expect(report.sections).toEqual(
      expect.arrayContaining(['about', 'experience', 'education', 'certifications', 'skills']),
    );
    expect(report.otherHeadings).not.toContain('Experience');
    expect(JSON.stringify(report)).not.toMatch(/Acme|Jane|merchant/);
  });

  it('is analysable and survives the payload sanitiser unchanged in substance', () => {
    expect(assessProfile(profile, report).canAnalyze).toBe(true);
    const payload = toProfilePayload(profile);
    expect(payload.name).toBe('Jane Doe');
    expect(payload.experience).toHaveLength(3);
    expect(payload.skills).toHaveLength(7);
  });
});

describe('LinkedIn parser: degraded pages', () => {
  it('top card only (still loading): name + headline, but warns and has no sections', () => {
    const { profile, report } = parse(TOP_CARD_ONLY_PAGE);
    expect(profile.name).toBe('Jane Doe');
    expect(profile.headline).toMatch(/Product Designer/);
    expect(report.sections).toEqual([]);
    expect(report.warnings.join(' ')).toMatch(/No profile sections/);
    // A headline alone is enough for the backend to build queries.
    expect(assessProfile(profile, report).canAnalyze).toBe(true);
  });

  it('unrecognisable page: falls back to the title, finds nothing, and is blocked', () => {
    const { profile, report } = parse(UNKNOWN_PAGE);
    expect(profile.name).toBe('Sign in');
    expect(profile.headline).toBeUndefined();
    expect(profile.experience).toEqual([]);
    expect(report.counts).toEqual({ skills: 0, experience: 0, education: 0, certifications: 0, projects: 0 });
    const verdict = assessProfile(profile, report);
    expect(verdict.canAnalyze).toBe(false);
    expect(verdict.blockingReason).toMatch(/headline or any job titles/);
  });

  it('never throws on an empty document', () => {
    expect(() => parse('<!doctype html><html><body></body></html>')).not.toThrow();
  });

  it('strips the unread-notification count from the title fallback', () => {
    const { profile } = parse('<html><head><title>(12) Ada Lovelace | LinkedIn</title></head><body><main></main></body></html>');
    expect(profile.name).toBe('Ada Lovelace');
  });
});

describe('profile quality gate', () => {
  const base = { skills: [], experience: [], education: [], certifications: [], projects: [], source: 'linkedin' };

  it('needs a headline or a job title', () => {
    expect(assessProfile({ ...base, name: 'X' }).canAnalyze).toBe(false);
    expect(assessProfile({ ...base, headline: 'Designer' }).canAnalyze).toBe(true);
    expect(assessProfile({ ...base, experience: [{ title: 'Designer' }] }).canAnalyze).toBe(true);
  });

  it('warns, without blocking, when no skills were found', () => {
    const verdict = assessProfile({ ...base, headline: 'Designer' });
    expect(verdict.canAnalyze).toBe(true);
    expect(verdict.warnings.join(' ')).toMatch(/No skills were found/);
  });
});


describe('LinkedIn parser: text-only markup (no headings, lists or accessibility spans)', () => {
  const { profile, report } = parse(TEXT_ONLY_PAGE);

  it('is detected as text-based, not structural', () => {
    expect(report.method).toBe('text');
    expect(report.page).toMatchObject({ h1: false, headings: 0, listItems: 0, ariaHidden: 0 });
    expect(report.page!.lines).toBeGreaterThan(30);
  });

  it('reads the top card, ignoring navigation, the sticky header copy and hidden text', () => {
    expect(profile.name).toBe('Sam Rivera');
    expect(profile.headline).toBe('AI/ML Builder | Researcher | Security | Product Engineer | GenAI');
    expect(profile.location).toBe('Ahmedabad, Gujarat, India');
    expect(JSON.stringify(profile)).not.toMatch(/Hidden banner|Home|Messaging/);
  });

  it('reads about without "see more"', () => {
    expect(profile.about).toBe('I build practical machine learning systems and write about security.');
  });

  it('reads single and grouped roles from their date lines', () => {
    expect(profile.experience.map((e) => e.title)).toEqual(['Machine Learning Engineer', 'Backend Developer', 'Intern']);
    expect(profile.experience[0]).toMatchObject({ company: 'Northwind Labs', start_date: 'Jan 2025', end_date: 'Present', location: 'Remote' });
    expect(profile.experience[0].description).toMatch(/ranking models/);
    expect(profile.experience[1]).toMatchObject({ company: 'Studio Nine', start_date: 'Feb 2023', end_date: 'Dec 2024' });
    expect(profile.experience[2]).toMatchObject({ company: 'Studio Nine' });
  });

  it('reads education with degree and field split', () => {
    expect(profile.education).toEqual([
      {
        institution: 'Gujarat Technological University',
        degree: 'Bachelor of Technology - BTech',
        field_of_study: 'Artificial Intelligence and machine learning',
        start_date: 'Sep 2024',
        end_date: 'May 2028',
      },
      { institution: 'Allen Career Institute', degree: 'Higher Secondary', field_of_study: 'Jee Preparation', start_date: 'Apr 2022', end_date: 'Mar 2024' },
    ]);
  });

  it('reads certifications and ignores credential ids, media blocks and "Show credential"', () => {
    expect(profile.certifications).toEqual([
      { name: 'Certified Cyber Defence Professional (CCDP)', issuer: 'Demmisto Technologies Pvt. Ltd', date: 'Sep 2026' },
      { name: 'Advanced Learning Algorithms', issuer: 'DeepLearning.AI', date: 'Jun 2025' },
    ]);
  });

  it('collects skills named on experience, education and certification lines, once each', () => {
    const names = profile.skills.map((s) => s.name);
    expect(names).toEqual(
      expect.arrayContaining(['Python', 'PyTorch', 'FastAPI', 'PostgreSQL', 'Docker', 'Git', 'C (Programming Language)', 'C++', 'Cybersecurity', 'Ethical Hacking']),
    );
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
    expect(names.some((n) => /\+\d/.test(n))).toBe(false);
  });

  it('does not read sidebar content after the last section as profile data', () => {
    expect(profile.education).toHaveLength(2); // the date line under "Courses" is not an education item
    expect(JSON.stringify(profile)).not.toMatch(/Pat Lee|Experience Designer|Top Voices|Education Weekly/);
  });

  it('is analysable', () => {
    expect(assessProfile(profile, report).canAnalyze).toBe(true);
    expect(toProfilePayload(profile).experience).toHaveLength(3);
  });
});

describe('collectLines', () => {
  const lines = (html: string) => collectLines(new DOMParser().parseFromString(html, 'text/html').body);

  it('starts a new line at block elements and joins inline text', () => {
    expect(lines('<div><span>Feb 2021</span> – <span>Feb 2022</span></div><p>Next</p>')).toEqual(['Feb 2021 – Feb 2022', 'Next']);
  });
  it('skips scripts, hidden elements, screen-reader copies and interface noise', () => {
    expect(
      lines(
        '<p>Keep</p><script>var x=1</script><div hidden>no</div><span class="visually-hidden">only for screen readers</span>' +
          '<button>Show all 9 licenses</button><button>Show credential</button><button>…see more</button><code>{"a":1}</code><p>Also keep</p>',
      ),
    ).toEqual(['Keep', 'Also keep']);
  });
  it('collapses a visible copy glued to its hidden duplicate', () => {
    expect(collapseDoubled('Python Python')).toBe('Python');
    expect(collapseDoubled('PythonPython')).toBe('Python');
    expect(collapseDoubled('Java Script')).toBe('Java Script');
  });
});
