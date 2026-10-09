import type { ExtractionReport, SkillItem } from '../../types';
import { clean, uniqueSkills } from './shared';
import { collectLines } from './lines';

/**
 * Reader for LinkedIn's full skills list (linkedin.com/in/<name>/details/skills/).
 *
 * That page has no headline, roles or education, so the normal profile parser
 * cannot be used on it. It is just a list: every <li> is one skill, and the first
 * line of the item is the skill's name.
 */

const ITEM = 'li, [role="listitem"]';

/** Tab / filter labels LinkedIn shows above the list; never a skill. */
const NOT_A_SKILL = /^(all|industry knowledge|tools\s*&\s*technologies|interpersonal skills|other skills|skills|show more|show less)$/i;

function readSkill(li: Element): SkillItem | null {
  const hidden = li.querySelector('span[aria-hidden="true"]');
  const lines = collectLines(li);
  const name = clean(hidden?.textContent) || lines[0] || '';
  if (!name || name.length > 100 || NOT_A_SKILL.test(name) || /^\d+$/.test(name)) return null;
  const match = lines.map((l) => /(\d+)\s+endorsements?/i.exec(l)).find(Boolean);
  return { name, endorsements: match ? Number(match[1]) : undefined };
}

export function parseSkillsPage(doc: Document): SkillItem[] {
  const root = doc.querySelector('main') ?? doc.body;
  const items = Array.from(root.querySelectorAll(ITEM)).filter((li) => !li.parentElement?.closest(ITEM));
  const skills: SkillItem[] = [];
  for (const li of items) {
    const skill = readSkill(li);
    if (skill) skills.push(skill);
  }
  return uniqueSkills(skills);
}

/**
 * LinkedIn fills this list in after the page opens, so if nothing is there yet,
 * wait (observer, no polling, no scrolling) for at most `maxMs`.
 */
export function readSkillsWhenReady(doc: Document, maxMs = 3000): Promise<SkillItem[]> {
  const first = parseSkillsPage(doc);
  if (first.length) return Promise.resolve(first);

  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const skills = parseSkillsPage(doc);
        if (skills.length) done(skills);
      }, 300);
    });
    const hard = setTimeout(() => done(parseSkillsPage(doc)), maxMs);
    const done = (skills: SkillItem[]) => {
      observer.disconnect();
      clearTimeout(hard);
      if (timer) clearTimeout(timer);
      resolve(skills);
    };
    observer.observe(doc.body ?? doc.documentElement, { childList: true, subtree: true });
  });
}

/** Counts only, like every other report. */
export function skillsPageReport(skillCount: number): ExtractionReport {
  return {
    source: 'linkedin',
    found: { name: false, headline: false, location: false, about: false },
    counts: { skills: skillCount, experience: 0, education: 0, certifications: 0, projects: 0 },
    sections: ['skills'],
    otherHeadings: [],
    warnings: [],
    method: 'structure',
  };
}
