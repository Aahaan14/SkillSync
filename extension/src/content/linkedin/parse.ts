import type {
  CertificationItem,
  EducationItem,
  ExperienceItem,
  ExtractionReport,
  Profile,
  ProjectItem,
  SectionStatus,
  SkillItem,
} from '../../types';
import {
  DATE_RANGE,
  NOISE_LINES,
  SKILLS_LINE,
  TOP_CARD_NOISE,
  clean,
  credentialId,
  headingCount,
  httpUrl,
  kindOf,
  looksLikeLocation,
  parseDates,
  parseSkillsLine,
  uniqueSkills,
  type SectionKind,
} from './shared';
import { collapseDoubled, collectLines } from './lines';
import {
  inlineSkills,
  parseCertificationsLines,
  parseEducationLines,
  parseExperienceLines,
  parseFromLines,
  parseProjectsLines,
  parseSkillsSectionLines,
  sectionBody,
} from './textParse';

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
  /** The number LinkedIn prints in the title, e.g. 23 for "Skills (23)". */
  declared?: number;
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
    found.push({ kind, container: containerFor(heading, headings, root), declared: headingCount(text) });
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

const ITEM = 'li, [role="listitem"]';

function topLevelItems(container: Element): Element[] {
  return Array.from(container.querySelectorAll(ITEM)).filter((li) => {
    const parentItem = li.parentElement?.closest(ITEM);
    return !parentItem || !container.contains(parentItem);
  });
}

/** First link in `item` whose text or label matches `pattern`, as an absolute http(s) URL. */
function linkWhere(item: Element, pattern: RegExp): string | undefined {
  for (const a of Array.from(item.querySelectorAll('a[href]')).slice(0, 12)) {
    const label = `${clean(a.textContent)} ${a.getAttribute('aria-label') ?? ''}`;
    if (!pattern.test(label)) continue;
    const url = httpUrl((a as HTMLAnchorElement).href || a.getAttribute('href'));
    if (url) return url;
  }
  return undefined;
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
    const id = lines.map(credentialId).find(Boolean);
    const url = linkWhere(li, /credential/i);
    out.push({
      name: lines[0],
      issuer,
      date: issued ? clean(issued.replace(/^issued\s+/i, '').split('·')[0]) : undefined,
      ...(id ? { credential_id: id } : {}),
      ...(url ? { credential_url: url } : {}),
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
    const url = linkWhere(li, /show project|view project|project link/i);
    items.push({ name: lines[0], description, ...(url ? { url } : {}) });
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

/**
 * The element holding the person's name. Normally the page's <h1>; some LinkedIn
 * layouts render it as an h2 / role="heading" instead, so fall back to the heading
 * whose text equals the name in the tab title ("Jane Doe | LinkedIn").
 */
function findNameElement(doc: Document, titleName: string): Element | null {
  const h1 = doc.querySelector('main h1') ?? doc.querySelector('h1');
  if (h1) return h1;
  const key = titleName.toLowerCase();
  if (!key) return null;
  const candidates = Array.from(doc.querySelectorAll('h2, h3, [role="heading"]')).slice(0, 80);
  return (
    candidates.find((el) => headingText(el).toLowerCase().replace(/\s*·.*$/, '').trim() === key) ?? null
  );
}

function parseTopCard(doc: Document): { name: string; headline?: string; location?: string } {
  const titleName = clean(doc.title)
    .replace(/^\(\d+\)\s*/, '')
    .replace(/\s*[|–-]\s*linkedin.*$/i, '');
  const nameEl = findNameElement(doc, titleName);
  const name = (nameEl ? collapseDoubled(headingText(nameEl).replace(/\s*·.*$/, '').trim()) : '') || titleName;

  if (!nameEl) return { name };

  // Walk up until the container also holds a second line of text (headline etc.).
  let card: Element | null = nameEl.parentElement;
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

/**
 * Attach "Show credential" links to certifications that were read from text. A link
 * is only attached when the smallest block around it that mentions an issue date names
 * exactly one of the certifications, so a link is never guessed onto the wrong entry.
 */
function attachCredentialUrls(container: Element, certs: CertificationItem[]): void {
  for (const a of Array.from(container.querySelectorAll('a[href]')).slice(0, 60)) {
    const label = `${clean(a.textContent)} ${a.getAttribute('aria-label') ?? ''}`;
    if (!/credential/i.test(label)) continue;
    const url = httpUrl((a as HTMLAnchorElement).href || a.getAttribute('href'));
    if (!url) continue;
    // Climb to the smallest block that has an "Issued ..." line, comparing whole lines
    // (textContent would glue neighbouring paragraphs together).
    let node: Element | null = a.parentElement;
    let entryLines: string[] = node ? collectLines(node) : [];
    while (node && node !== container && !entryLines.some((l) => /^issued\b/i.test(l))) {
      node = node.parentElement;
      entryLines = node ? collectLines(node) : [];
    }
    const hits = certs.filter((c) => entryLines.includes(c.name));
    if (hits.length === 1 && !hits[0].credential_url) hits[0].credential_url = url;
  }
}

// ─── page state ───

/** Placeholders LinkedIn shows while a part of the page is still loading. */
const LOADING_SELECTOR =
  '[aria-busy="true"], [role="progressbar"], .artdeco-loader, [class*="skeleton"], [class*="Skeleton"], [class*="shimmer"], [class*="Shimmer"]';

const SECTION_KINDS: SectionKind[] = ['about', 'experience', 'education', 'certifications', 'skills', 'projects'];

const SECTION_LABEL: Record<SectionKind, string> = {
  about: 'About',
  experience: 'Experience',
  education: 'Education',
  certifications: 'Licenses & certifications',
  skills: 'Skills',
  projects: 'Projects',
};

/** "Show all 23 skills" / link to the separate skills page. The page is never opened for the user. */
function inspectSkillsLink(doc: Document): { linkPresent: boolean; declared?: number } {
  let linkPresent = false;
  let declared: number | undefined;
  for (const a of Array.from(doc.querySelectorAll('a[href]')).slice(0, 500)) {
    const href = a.getAttribute('href') ?? '';
    const label = `${clean(a.textContent)} ${a.getAttribute('aria-label') ?? ''}`;
    const isSkillsLink = /\/details\/skills/i.test(href) || /show all\s+\d*\s*skills?/i.test(label);
    if (!isSkillsLink) continue;
    linkPresent = true;
    const count = /(\d+)\s+skills?/i.exec(label);
    if (count && declared === undefined) declared = Number(count[1]);
  }
  return { linkPresent, declared };
}

// ─── entry point ───

export function parseLinkedInProfile(doc: Document, url: string): { profile: Profile; report: ExtractionReport } {
  const warnings: string[] = [];
  const top = parseTopCard(doc);
  const discovered = discoverSections(doc);
  const { found } = discovered;
  // The diagnostic lists section names, not people: drop the profile owner's own name
  // when LinkedIn renders it as a heading.
  const ownName = top.name.toLowerCase();
  const otherHeadings = discovered.otherHeadings.filter(
    (h) => !ownName || h.toLowerCase().replace(/\s*·.*$/, '').trim() !== ownName,
  );
  const section = (kind: SectionKind) => found.find((f) => f.kind === kind)?.container;
  const declaredFor = (kind: SectionKind) => found.find((f) => f.kind === kind)?.declared;

  let usedText = false;

  // Scoped fallback: when a section was found but its markup has no list items we can
  // read, parse that section's own visible lines (never the whole page, so sidebar
  // text cannot leak in).
  const scopedLines = (kind: SectionKind): string[] => {
    const container = section(kind);
    return container ? sectionBody(collectLines(container), kind) : [];
  };

  const experience = section('experience') ? parseExperience(section('experience')!) : { items: [], skills: [] };
  if (section('experience') && !experience.items.length) {
    const lines = scopedLines('experience');
    const items = parseExperienceLines(lines);
    if (items.length) {
      experience.items = items;
      experience.skills.push(...inlineSkills(lines));
      usedText = true;
    }
  }

  const projects = section('projects') ? parseProjects(section('projects')!) : { items: [], skills: [] };
  if (section('projects') && !projects.items.length) {
    const lines = scopedLines('projects');
    const items = parseProjectsLines(lines);
    if (items.length) {
      projects.items = items;
      projects.skills.push(...inlineSkills(lines));
      usedText = true;
    }
  }

  let sectionSkills = section('skills') ? parseSkillsSection(section('skills')!) : [];
  if (section('skills') && !sectionSkills.length) {
    const items = parseSkillsSectionLines(scopedLines('skills'));
    if (items.length) {
      sectionSkills = items;
      usedText = true;
    }
  }

  let education = section('education') ? parseEducation(section('education')!) : [];
  if (section('education') && !education.length) {
    education = parseEducationLines(scopedLines('education'));
    if (education.length) usedText = true;
  }

  let certifications = section('certifications') ? parseCertifications(section('certifications')!) : [];
  if (section('certifications') && !certifications.length) {
    certifications = parseCertificationsLines(scopedLines('certifications'));
    if (certifications.length) {
      usedText = true;
      attachCredentialUrls(section('certifications')!, certifications);
    }
  }

  const profile: Profile = {
    name: top.name || undefined,
    headline: top.headline,
    location: top.location,
    about: section('about') ? parseAbout(section('about')!, /^about$/i) : undefined,
    profile_url: url,
    source: 'linkedin',
    skills: uniqueSkills(sectionSkills, experience.skills, projects.skills),
    experience: experience.items,
    education,
    certifications,
    projects: projects.items,
  };
  const structuralFound = found.length > 0;

  // Last strategy: plain visible text of the whole page. It fills only what the HTML
  // structure and the scoped section parse could not provide, so a page they already
  // handle is unchanged.
  const root = doc.querySelector('main') ?? doc.body;
  const lines = collectLines(root);
  const text = parseFromLines(lines, profile.name);
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

  // ─── page state: is a missing section absent, or just not loaded yet? ───
  const readyState = doc.readyState || 'complete';
  const loadingIndicators = root.querySelector(LOADING_SELECTOR) !== null;
  const pageComplete = readyState === 'complete' && !loadingIndicators && sections.length > 0;

  const entries: Record<SectionKind, number> = {
    about: profile.about ? 1 : 0,
    experience: profile.experience.length,
    education: profile.education.length,
    certifications: profile.certifications.length,
    skills: profile.skills.length,
    projects: profile.projects.length,
  };
  const sectionStatus = Object.fromEntries(
    SECTION_KINDS.map((kind): [SectionKind, SectionStatus] => {
      if (sections.includes(kind)) return [kind, entries[kind] > 0 ? 'extracted' : 'empty'];
      return [kind, pageComplete ? 'absent' : 'unavailable'];
    }),
  ) as Record<SectionKind, SectionStatus>;

  const skillsLink = inspectSkillsLink(doc);
  const declaredSkills = declaredFor('skills') ?? skillsLink.declared;
  const declaredCerts = declaredFor('certifications');

  // ─── warnings ───
  if (!sections.length) {
    warnings.push('No profile sections (Experience, Education, ...) were found. The page may still be loading, or LinkedIn changed its layout.');
  }
  if (sections.length && !profile.headline) warnings.push('No headline was found.');
  if (sections.includes('experience') && !profile.experience.length) warnings.push('The Experience section was found but no roles could be read.');
  for (const kind of ['education', 'certifications', 'projects'] as const) {
    if (sectionStatus[kind] === 'empty') {
      warnings.push(`The ${SECTION_LABEL[kind]} section was found but no entries could be read.`);
    }
  }
  if (sections.length && !pageComplete) {
    const pending = SECTION_KINDS.filter((k) => sectionStatus[k] === 'unavailable').map((k) => SECTION_LABEL[k]);
    if (pending.length) {
      warnings.push(
        `LinkedIn was still loading when the page was read, so these could not be checked: ${pending.join(', ')}. Scroll down so they appear, wait a moment, then try again.`,
      );
    }
  }
  if (!profile.skills.length) {
    warnings.push('No skills were found on this page. LinkedIn shows most skills on a separate "Show all skills" page.');
  } else if (declaredSkills !== undefined && profile.skills.length < declaredSkills) {
    warnings.push(
      `Only ${profile.skills.length} of ${declaredSkills} skills are visible on this profile page. LinkedIn lists the rest on its "Show all skills" page. Open that page, scroll to the bottom, then open SkillSync there and click "Add skills from this page".`,
    );
  }
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
    sectionStatus,
    declaredCounts: { skills: declaredSkills, certifications: declaredCerts },
    skillsPage: { linkPresent: skillsLink.linkPresent },
    load: { readyState, loadingIndicators, complete: pageComplete },
  };

  return { profile, report };
}
