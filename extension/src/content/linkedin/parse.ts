import type {
  CertificationItem,
  EducationItem,
  ExperienceItem,
  ExtractionReport,
  Profile,
  ProjectItem,
  SkillItem,
} from '../../types';
import {
  DATE_RANGE,
  NOISE_LINES,
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
import { collectLines } from './lines';
import { parseFromLines } from './textParse';

/**
 * LinkedIn profile parser.
 *
 * LinkedIn renames its CSS classes constantly, so this deliberately avoids class
 * names. It relies on two things that have been stable for years:
 *   1. Sections are introduced by a visible heading ("Experience", "Education"...).
 *   2. Every visible line is rendered twice: once in <span aria-hidden="true">
 *      (what you see) and once in a visually-hidden span for screen readers. The
 *      aria-hidden copy is read, so each line appears exactly once.
 *
 * It is a pure function of a Document so it can be unit-tested without a browser.
 * It cannot be verified against LinkedIn from CI; the ExtractionReport it returns
 * tells the user (and us) exactly which parts were found on a real page.
 */

// ─── text helpers ───

function dedupeConsecutive(lines: string[]): string[] {
  return lines.filter((line, index) => line && line !== lines[index - 1]);
}

/**
 * Visible lines of an element, in order. Prefers aria-hidden spans (one per line,
 * no screen-reader duplicates); falls back to leaf text for markup without them.
 * Text inside `skip` (e.g. nested role lists) is ignored.
 */
function linesOf(root: Element, skip?: Element[]): string[] {
  const inSkipped = (el: Element) => !!skip?.some((s) => s !== el && s.contains(el));

  const hidden = Array.from(root.querySelectorAll('span[aria-hidden="true"]')).filter(
    (el) => !inSkipped(el) && !el.parentElement?.closest('[aria-hidden="true"]'),
  );
  if (hidden.length) {
    return dedupeConsecutive(hidden.map((el) => clean(el.textContent)).filter((l) => !NOISE_LINES.test(l)));
  }

  const leaves = Array.from(root.querySelectorAll('*')).filter(
    (el) =>
      el.children.length === 0 &&
      !inSkipped(el) &&
      !el.closest('.visually-hidden, .sr-only, button, script, style'),
  );
  return dedupeConsecutive(leaves.map((el) => clean(el.textContent)).filter((l) => !NOISE_LINES.test(l)));
}

function headingText(heading: Element): string {
  const visible = heading.querySelector('span[aria-hidden="true"]');
  return clean((visible ?? heading).textContent);
}

// ─── section discovery ───

interface Found {
  kind: SectionKind;
  container: Element;
}

/** Smallest ancestor of a heading that holds the section's content but no other section's heading. */
function containerFor(heading: Element, headings: Element[], root: Element): Element {
  const own = headingText(heading).length;
  let best: Element = heading;
  let node = heading.parentElement;
  while (node && node !== root.parentElement) {
    const foreign = headings.some((h) => h !== heading && node!.contains(h));
    if (foreign) break;
    best = node;
    const hasItems = node.querySelector('li') !== null;
    if (hasItems || clean(node.textContent).length > own + 30) {
      // Keep climbing only while the parent still has no other section inside it,
      // so wrappers (card padding, anchors) are included.
      const parent = node.parentElement;
      if (!parent || headings.some((h) => h !== heading && parent.contains(h))) break;
    }
    node = node.parentElement;
  }
  return best;
}

function discoverSections(doc: Document): { found: Found[]; otherHeadings: string[] } {
  const root = doc.querySelector('main') ?? doc.body;
  const headings = Array.from(root.querySelectorAll('h2, [role="heading"]')).filter(
    (h) => headingText(h).length > 0 && headingText(h).length < 80,
  );

  const found: Found[] = [];
  const seen = new Set<SectionKind>();
  const otherHeadings: string[] = [];

  for (const heading of headings) {
    const text = headingText(heading);
    const kind = kindOf(text);
    if (!kind) {
      otherHeadings.push(text);
      continue;
    }
    if (seen.has(kind)) continue;
    seen.add(kind);
    found.push({ kind, container: containerFor(heading, headings, root) });
  }

  // Older markup: anchor divs (#experience, #education...) sit right before the section.
  const anchors: Array<[SectionKind, string]> = [
    ['about', 'about'],
    ['experience', 'experience'],
    ['education', 'education'],
    ['skills', 'skills'],
    ['certifications', 'licenses_and_certifications'],
    ['projects', 'projects'],
  ];
  for (const [kind, id] of anchors) {
    if (seen.has(kind)) continue;
    const container = doc.getElementById(id)?.closest('section');
    if (container) {
      seen.add(kind);
      found.push({ kind, container });
    }
  }

  return { found, otherHeadings: Array.from(new Set(otherHeadings)).slice(0, 12) };
}

function topLevelItems(container: Element): Element[] {
  return Array.from(container.querySelectorAll('li')).filter((li) => {
    const parentItem = li.parentElement?.closest('li');
    return !parentItem || !container.contains(parentItem);
  });
}

// ─── item parsing ───

interface RoleResult {
  role: ExperienceItem;
  skills: string[];
}

function parseRole(lines: string[], companyHint?: string): RoleResult | null {
  if (!lines.length) return null;
  const skills: string[] = [];
  const rest: string[] = [];
  for (const line of lines.slice(1)) {
    const parsed = parseSkillsLine(line);
    if (parsed) skills.push(...parsed);
    else rest.push(line);
  }

  const dateIndex = rest.findIndex((line) => DATE_RANGE.test(line));
  const dates = dateIndex >= 0 ? parseDates(rest[dateIndex]) : null;

  let company = companyHint;
  if (!company && rest.length && dateIndex !== 0) {
    company = clean(rest[0].split('·')[0]);
  }

  const afterDate = dateIndex >= 0 ? rest.slice(dateIndex + 1) : rest.slice(company ? 1 : 0);
  const location = afterDate.find(looksLikeLocation);
  const description = afterDate
    .filter((line) => line !== location && line.length > 40)
    .sort((a, b) => b.length - a.length)[0];

  return {
    role: {
      title: lines[0],
      company: company || undefined,
      location,
      start_date: dates?.start,
      end_date: dates?.end,
      description,
    },
    skills,
  };
}

function parseExperience(container: Element): { items: ExperienceItem[]; skills: string[] } {
  const items: ExperienceItem[] = [];
  const skills: string[] = [];

  for (const li of topLevelItems(container)) {
    const nested = Array.from(li.querySelectorAll('li'));
    if (nested.length) {
      // Several roles at one company: the outer item is the company, inner items are roles.
      const company = linesOf(li, nested)[0];
      for (const roleItem of nested.filter((n) => n.parentElement?.closest('li') === li)) {
        const parsed = parseRole(linesOf(roleItem), company);
        if (parsed) {
          items.push(parsed.role);
          skills.push(...parsed.skills);
        }
      }
      if (!items.length) {
        const parsed = parseRole(linesOf(li));
        if (parsed) {
          items.push(parsed.role);
          skills.push(...parsed.skills);
        }
      }
      continue;
    }
    const parsed = parseRole(linesOf(li));
    if (parsed) {
      items.push(parsed.role);
      skills.push(...parsed.skills);
    }
  }
  return { items, skills };
}

function parseEducation(container: Element): EducationItem[] {
  const out: EducationItem[] = [];
  for (const li of topLevelItems(container)) {
    const lines = linesOf(li);
    if (!lines.length) continue;
    const dateLine = lines.slice(1).find((l) => parseDates(l));
    const dates = dateLine ? parseDates(dateLine) : null;
    const detail = lines.slice(1).find((l) => l !== dateLine && !SKILLS_LINE.test(l));

    let degree: string | undefined;
    let field: string | undefined;
    if (detail) {
      const comma = detail.indexOf(', ');
      degree = comma > 0 ? detail.slice(0, comma) : detail;
      field = comma > 0 ? detail.slice(comma + 2) : undefined;
    }
    out.push({
      institution: lines[0],
      degree,
      field_of_study: field,
      start_date: dates?.start,
      end_date: dates?.end,
    });
  }
  return out;
}

function parseCertifications(container: Element): CertificationItem[] {
  const out: CertificationItem[] = [];
  for (const li of topLevelItems(container)) {
    const lines = linesOf(li);
    if (!lines.length) continue;
    const issued = lines.find((l) => /^issued\s/i.test(l));
    const issuer = lines.slice(1).find((l) => !/^(issued|expires|credential id)/i.test(l) && !SKILLS_LINE.test(l));
    out.push({
      name: lines[0],
      issuer,
      date: issued ? clean(issued.replace(/^issued\s+/i, '').split('·')[0]) : undefined,
    });
  }
  return out;
}

function parseProjects(container: Element): { items: ProjectItem[]; skills: string[] } {
  const items: ProjectItem[] = [];
  const skills: string[] = [];
  for (const li of topLevelItems(container)) {
    const lines = linesOf(li);
    if (!lines.length) continue;
    const rest: string[] = [];
    for (const line of lines.slice(1)) {
      const parsed = parseSkillsLine(line);
      if (parsed) skills.push(...parsed);
      else rest.push(line);
    }
    const description = rest.filter((l) => l.length > 40).sort((a, b) => b.length - a.length)[0];
    items.push({ name: lines[0], description });
  }
  return { items, skills };
}

function parseSkillsSection(container: Element): SkillItem[] {
  const out: SkillItem[] = [];
  for (const li of topLevelItems(container)) {
    const lines = linesOf(li);
    const name = lines[0];
    if (!name || name.length > 100) continue;
    const endorsements = lines
      .map((l) => /(\d+)\s+endorsements?/i.exec(l))
      .find(Boolean);
    out.push({ name, endorsements: endorsements ? Number(endorsements[1]) : undefined });
  }
  return out;
}

function parseAbout(container: Element, headingLabel: RegExp): string | undefined {
  const lines = linesOf(container).filter((l) => !headingLabel.test(l));
  const text = lines.join('\n').trim();
  return text || undefined;
}

// ─── top card ───

function parseTopCard(doc: Document): { name: string; headline?: string; location?: string } {
  const h1 = doc.querySelector('main h1') ?? doc.querySelector('h1');
  const titleName = clean(doc.title)
    .replace(/^\(\d+\)\s*/, '')
    .replace(/\s*[|–-]\s*linkedin.*$/i, '');
  const name = clean(h1?.textContent) || titleName;

  if (!h1) return { name };

  // Walk up until the container also holds a second line of text (headline etc.).
  let card: Element | null = h1.parentElement;
  while (card && card.parentElement && linesOf(card).filter((l) => l !== name).length < 2) {
    card = card.parentElement;
  }
  const lines = card ? linesOf(card) : [];
  const afterName = lines.slice(lines.findIndex((l) => l === name) + 1).filter((l) => !TOP_CARD_NOISE.test(l));

  // LinkedIn's order is name -> headline -> (company/school) -> location.
  const headline = afterName.find((l) => l.length >= 4 && !/^·/.test(l));
  const locationRaw = afterName.slice(afterName.indexOf(headline ?? '') + 1).find(looksLikeLocation);
  const location = locationRaw ? clean(locationRaw.replace(/·?\s*contact info\s*$/i, '')) : undefined;
  return { name, headline, location };
}

// ─── entry point ───

export function parseLinkedInProfile(doc: Document, url: string): { profile: Profile; report: ExtractionReport } {
  const warnings: string[] = [];
  const top = parseTopCard(doc);
  const { found, otherHeadings } = discoverSections(doc);
  const section = (kind: SectionKind) => found.find((f) => f.kind === kind)?.container;

  const experience = section('experience') ? parseExperience(section('experience')!) : { items: [], skills: [] };
  const projects = section('projects') ? parseProjects(section('projects')!) : { items: [], skills: [] };
  const sectionSkills = section('skills') ? parseSkillsSection(section('skills')!) : [];

  const profile: Profile = {
    name: top.name || undefined,
    headline: top.headline,
    location: top.location,
    about: section('about') ? parseAbout(section('about')!, /^about$/i) : undefined,
    profile_url: url,
    source: 'linkedin',
    skills: uniqueSkills(sectionSkills, experience.skills, projects.skills),
    experience: experience.items,
    education: section('education') ? parseEducation(section('education')!) : [],
    certifications: section('certifications') ? parseCertifications(section('certifications')!) : [],
    projects: projects.items,
  };
  const structuralFound = found.length > 0;

  // Second strategy: plain visible text. It fills only what the HTML structure
  // could not provide, so a page the structural parser already handles is unchanged.
  const root = doc.querySelector('main') ?? doc.body;
  const lines = collectLines(root);
  const text = parseFromLines(lines, profile.name);
  let usedText = false;
  const fill = <T,>(current: T[], fallback: T[]): T[] => {
    if (current.length || !fallback.length) return current;
    usedText = true;
    return fallback;
  };
  if (!profile.headline && text.headline) {
    profile.headline = text.headline;
    usedText = true;
  }
  if (!profile.location && text.location) {
    profile.location = text.location;
    usedText = true;
  }
  if (!profile.about && text.about) {
    profile.about = text.about;
    usedText = true;
  }
  profile.experience = fill(profile.experience, text.experience);
  profile.education = fill(profile.education, text.education);
  profile.certifications = fill(profile.certifications, text.certifications);
  profile.projects = fill(profile.projects, text.projects);
  const mergedSkills = uniqueSkills(profile.skills, text.skills);
  if (mergedSkills.length > profile.skills.length) usedText = true;
  profile.skills = mergedSkills;

  const sections = Array.from(new Set<SectionKind>([...found.map((f) => f.kind), ...text.sections]));

  if (!sections.length) {
    warnings.push('No profile sections (Experience, Education, ...) were found. The page may still be loading, or LinkedIn changed its layout.');
  }
  if (sections.length && !profile.headline) warnings.push('No headline was found.');
  if (sections.includes('experience') && !profile.experience.length) warnings.push('The Experience section was found but no roles could be read.');
  if (!profile.skills.length) warnings.push('No skills were found on this page. LinkedIn shows most skills on a separate "Show all skills" page.');
  if (!sections.includes('skills') && profile.skills.length) {
    warnings.push('Skills were gathered from your experience entries only; the full skills list is not on this page.');
  }

  const report: ExtractionReport = {
    source: 'linkedin',
    found: {
      name: !!profile.name,
      headline: !!profile.headline,
      location: !!profile.location,
      about: !!profile.about,
    },
    counts: {
      skills: profile.skills.length,
      experience: profile.experience.length,
      education: profile.education.length,
      certifications: profile.certifications.length,
      projects: profile.projects.length,
    },
    sections,
    otherHeadings,
    warnings,
    method: usedText ? (structuralFound ? 'mixed' : 'text') : 'structure',
    page: {
      lines: lines.length,
      h1: !!doc.querySelector('h1'),
      headings: doc.querySelectorAll('h2, [role="heading"]').length,
      listItems: doc.querySelectorAll('li').length,
      ariaHidden: doc.querySelectorAll('span[aria-hidden="true"]').length,
    },
  };

  return { profile, report };
}
