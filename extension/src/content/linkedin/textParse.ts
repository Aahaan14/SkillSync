import type {
  CertificationItem,
  EducationItem,
  ExperienceItem,
  ProjectItem,
  SkillItem,
} from '../../types';
import {
  DATE_RANGE,
  SKILLS_LINE,
  TOP_CARD_NOISE,
  clean,
  kindOf,
  looksLikeLocation,
  parseDates,
  parseSkillsLine,
  uniqueSkills,
  type SectionKind,
} from './shared';

/**
 * Line-based LinkedIn parser.
 *
 * Input is just the visible text lines of the page, in reading order (see
 * lines.ts). It therefore works whatever tags, classes or accessibility markup
 * LinkedIn uses. The price is that it infers structure from wording:
 *   - a section starts at a line that is exactly its title ("Experience");
 *   - an item is located by its date range ("Feb 2021 - Feb 2022"), or for
 *     certifications by its "Issued ..." line, and the lines just above give
 *     the title / organisation.
 * It is deliberately forgiving: anything it cannot place is skipped, never
 * guessed into the wrong field.
 */

export interface TextParse {
  headline?: string;
  location?: string;
  about?: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  certifications: CertificationItem[];
  projects: ProjectItem[];
  skills: SkillItem[];
  sections: SectionKind[];
}

/** Section titles we do not read but which end the section above them. */
const OTHER_SECTION_TITLES =
  /^(interests|languages|recommendations|courses|honou?rs?\s*(&|and)\s*awards|publications|patents|volunteering|volunteer experience|organi[sz]ations|test scores|causes|activity|analytics|resources|featured|highlights|services|more profiles for you|people also viewed|people you may know|you might like|explore premium profiles|suggested for you|profile language|public profile\s*(&|and)\s*url|ad options|accessibility|talent solutions|help center|privacy\s*(&|and)\s*terms|get the linkedin app|business services)\b/i;

const DURATION_ONLY = /^\d+\s*(yrs?|years?|mos?|months?)(\s+\d+\s*(mos?|months?))?$/i;
const EMPLOYMENT = /·\s*(full[- ]time|part[- ]time|self[- ]employed|freelance|contract|internship|apprenticeship|seasonal|temporary|volunteer)\b/i;
const DEGREE =
  /\b(bachelor|master|doctor|ph\.?d|b\.?\s?tech|m\.?\s?tech|b\.?e\.?|m\.?e\.?|b\.?sc|m\.?sc|b\.?a\.?|m\.?a\.?|mba|diploma|associate|certificate|higher secondary|secondary|high school|hsc|ssc|degree)\b/i;
const NOT_A_TITLE = /^(credential id|expires|issued|associated with|skills?:)/i;

function stripCount(line: string): string {
  return line.replace(/\s*\(\d+\)\s*$/, '').replace(/\s*[↗→]\s*$/, '').trim();
}

interface Boundary {
  index: number;
  kind: SectionKind | null; // null = a title we do not read
}

function findBoundaries(lines: string[], from: number): Boundary[] {
  const seen = new Set<SectionKind>();
  const out: Boundary[] = [];
  for (let i = from; i < lines.length; i++) {
    const text = stripCount(lines[i]);
    const kind = kindOf(text);
    if (kind) {
      if (seen.has(kind)) continue; // only the first occurrence is the real section
      seen.add(kind);
      out.push({ index: i, kind });
    } else if (OTHER_SECTION_TITLES.test(text) && text.length < 60) {
      out.push({ index: i, kind: null });
    }
  }
  return out;
}

function sectionLines(lines: string[], boundaries: Boundary[], kind: SectionKind): string[] | undefined {
  const at = boundaries.findIndex((b) => b.kind === kind);
  if (at < 0) return undefined;
  const start = boundaries[at].index + 1;
  const end = boundaries[at + 1]?.index ?? lines.length;
  return lines.slice(start, end);
}

function inlineSkills(lines: string[]): string[] {
  return lines.flatMap((l) => parseSkillsLine(l) ?? []);
}

// ─── sections ───

function parseExperience(lines: string[]): ExperienceItem[] {
  const items: ExperienceItem[] = [];
  const dateAt = lines.map((l, i) => (DATE_RANGE.test(l) ? i : -1)).filter((i) => i >= 0);

  // "Company" followed by "2 yrs 2 mos" introduces several roles at one company.
  const headerAt = new Map<number, string>();
  lines.forEach((line, k) => {
    if (DURATION_ONLY.test(lines[k + 1] ?? '') && !DURATION_ONLY.test(line) && !DATE_RANGE.test(line)) {
      headerAt.set(k, line);
    }
  });

  let group: string | undefined;
  dateAt.forEach((i, n) => {
    const previousDate = dateAt[n - 1] ?? -1;
    for (let k = previousDate + 1; k < i; k++) {
      const header = headerAt.get(k);
      if (header) group = header;
    }

    const prev = lines[i - 1];
    const prev2 = lines[i - 2];
    let title: string | undefined;
    let company: string | undefined;

    if (prev && EMPLOYMENT.test(prev)) {
      // "Title" / "Company · Full-time" / dates
      company = clean(prev.split('·')[0]);
      title = prev2;
      group = undefined;
    } else if (group && prev && !DURATION_ONLY.test(prev)) {
      // A role listed under a company header
      title = prev;
      company = group;
    } else if (prev2 && prev) {
      // "Title" / "Company" / dates
      title = prev2;
      company = prev;
    } else {
      title = prev;
    }

    if (!title || title.length > 140 || NOT_A_TITLE.test(title) || SKILLS_LINE.test(title) || DATE_RANGE.test(title) || DURATION_ONLY.test(title)) {
      return;
    }

    const dates = parseDates(lines[i]);
    const nextDate = dateAt[n + 1];
    const block = lines.slice(i + 1, nextDate !== undefined ? nextDate - 1 : lines.length);
    const location = block.slice(0, 3).find(looksLikeLocation);
    const description = block
      .filter((l) => l !== location && l.length > 40 && !SKILLS_LINE.test(l))
      .sort((a, b) => b.length - a.length)[0];

    items.push({
      title,
      company: company && company !== title ? company : undefined,
      location,
      start_date: dates?.start,
      end_date: dates?.end,
      description,
    });
  });
  return items;
}

function parseEducation(lines: string[]): EducationItem[] {
  const items: EducationItem[] = [];
  lines.forEach((line, i) => {
    const dates = DATE_RANGE.test(line) ? parseDates(line) : null;
    if (!dates) return;
    const prev = lines[i - 1];
    if (!prev || SKILLS_LINE.test(prev)) return;

    let institution = prev;
    let degreeLine: string | undefined;
    if (DEGREE.test(prev) && lines[i - 2] && !DATE_RANGE.test(lines[i - 2]) && !SKILLS_LINE.test(lines[i - 2])) {
      degreeLine = prev;
      institution = lines[i - 2];
    }

    let degree: string | undefined;
    let field: string | undefined;
    if (degreeLine) {
      const comma = degreeLine.indexOf(', ');
      degree = comma > 0 ? degreeLine.slice(0, comma) : degreeLine;
      field = comma > 0 ? degreeLine.slice(comma + 2) : undefined;
    }
    items.push({ institution, degree, field_of_study: field, start_date: dates.start, end_date: dates.end });
  });
  return items;
}

function parseCertifications(lines: string[]): CertificationItem[] {
  const items: CertificationItem[] = [];
  lines.forEach((line, i) => {
    if (!/^issued\b/i.test(line)) return;
    const prev = lines[i - 1];
    const prev2 = lines[i - 2];
    if (!prev) return;

    const hasIssuer = !!prev2 && !NOT_A_TITLE.test(prev2) && !SKILLS_LINE.test(prev2) && !DATE_RANGE.test(prev2);
    items.push({
      name: hasIssuer ? prev2 : prev,
      issuer: hasIssuer ? prev : undefined,
      date: clean(line.replace(/^issued\s+/i, '').split('·')[0]),
    });
  });
  return items;
}

function parseProjects(lines: string[]): ProjectItem[] {
  const items: ProjectItem[] = [];
  lines.forEach((line, i) => {
    if (!DATE_RANGE.test(line) || !lines[i - 1] || NOT_A_TITLE.test(lines[i - 1])) return;
    const nextDate = lines.findIndex((l, j) => j > i && DATE_RANGE.test(l));
    const block = lines.slice(i + 1, nextDate > 0 ? nextDate - 1 : lines.length);
    const description = block.filter((l) => l.length > 40 && !SKILLS_LINE.test(l)).sort((a, b) => b.length - a.length)[0];
    items.push({ name: lines[i - 1], description });
  });
  return items;
}

function parseSkillsSection(lines: string[]): SkillItem[] {
  return lines
    .filter(
      (l) =>
        l.length >= 2 &&
        l.length <= 50 &&
        !/endors|assessment|^\d|show all|·|connection|mutual|associated|^\+/i.test(l) &&
        !SKILLS_LINE.test(l),
    )
    .slice(0, 60)
    .map((name) => ({ name }));
}

// ─── entry point ───

export function parseFromLines(lines: string[], name: string | undefined): TextParse {
  const nameKey = (name ?? '').toLowerCase();
  const nameIdx = nameKey
    ? lines.findIndex((l) => {
        const text = l.toLowerCase().replace(/\s*·.*$/, '').trim();
        return text === nameKey;
      })
    : -1;

  const boundaries = findBoundaries(lines, Math.max(nameIdx, 0));
  const firstBoundary = boundaries[0]?.index ?? Math.min(lines.length, (nameIdx >= 0 ? nameIdx : 0) + 40);

  // Top card: the lines between the name and the first section. Only trusted when
  // the name really appears in the text; otherwise (login wall, error page) the
  // first lines are navigation, not a headline.
  const top =
    nameIdx < 0
      ? []
      : lines
          .slice(nameIdx + 1, Math.min(firstBoundary, nameIdx + 41))
          .filter((l) => l.toLowerCase() !== nameKey && !TOP_CARD_NOISE.test(l));
  const headline = top.find((l) => l.length >= 4 && !/^·/.test(l));
  const locationLine = top.slice(top.indexOf(headline ?? '') + 1).find(looksLikeLocation);
  const location = locationLine ? clean(locationLine.replace(/·?\s*contact info\s*$/i, '')) : undefined;

  const get = (kind: SectionKind) => sectionLines(lines, boundaries, kind);
  const about = get('about')
    ?.filter((l) => !/see more/i.test(l))
    .join('\n')
    .trim();

  const experienceLines = get('experience') ?? [];
  const educationLines = get('education') ?? [];
  const certificationLines = get('certifications') ?? [];
  const projectLines = get('projects') ?? [];
  const skillLines = get('skills');

  return {
    headline,
    location,
    about: about || undefined,
    experience: parseExperience(experienceLines),
    education: parseEducation(educationLines),
    certifications: parseCertifications(certificationLines),
    projects: parseProjects(projectLines),
    skills: uniqueSkills(
      skillLines ? parseSkillsSection(skillLines) : [],
      inlineSkills(experienceLines),
      inlineSkills(educationLines),
      inlineSkills(certificationLines),
      inlineSkills(projectLines),
    ),
    sections: boundaries.flatMap((b) => (b.kind ? [b.kind] : [])),
  };
}
