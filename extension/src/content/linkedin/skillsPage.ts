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

/** Lines that can follow a skill's name inside its item; never a name themselves. */
const DETAIL_LINE = /^(\d+\s+(endorsements?|experiences?|mutual)|endorse$|passed\b)/i;

function readSkill(li: Element): SkillItem | null {
  const hidden = li.querySelector('span[aria-hidden="true"]');
  const lines = collectLines(li);
  const name = clean(hidden?.textContent) || lines[0] || '';
  if (!name || name.length > 100 || NOT_A_SKILL.test(name) || DETAIL_LINE.test(name) || /^\d+$/.test(name)) return null;
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

export interface SkillsWaitOptions {
  /** Stop once the page has not changed for this long (the list has finished filling in). */
  quietMs?: number;
  /** Hard upper bound on the whole wait. */
  maxMs?: number;
}

/**
 * LinkedIn fills this list in after the page opens and in several batches, so a read
 * the instant the popup asks can return only the first batch. This waits (observer, no
 * polling, no scrolling, no clicking) until the page has been quiet for `quietMs` and at
 * least one skill is visible, or `maxMs` has passed, whichever is first.
 */
export function readSkillsWhenReady(doc: Document, { quietMs = 700, maxMs = 4000 }: SkillsWaitOptions = {}): Promise<SkillItem[]> {
  return new Promise((resolve) => {
    let finished = false;
    let quietTimer: ReturnType<typeof setTimeout> | undefined;
    let hardTimer: ReturnType<typeof setTimeout> | undefined;
    let observer: MutationObserver | undefined;

    const finish = () => {
      if (finished) return;
      finished = true;
      observer?.disconnect();
      if (quietTimer) clearTimeout(quietTimer);
      if (hardTimer) clearTimeout(hardTimer);
      resolve(parseSkillsPage(doc));
    };
    const armQuiet = () => {
      if (quietTimer) clearTimeout(quietTimer);
      quietTimer = setTimeout(() => {
        // Quiet, but nothing to read yet: keep waiting (until the hard limit) for the first batch.
        if (parseSkillsPage(doc).length > 0) finish();
        else armQuiet();
      }, quietMs);
    };

    try {
      observer = new MutationObserver(armQuiet);
      observer.observe(doc.body ?? doc.documentElement, { childList: true, subtree: true, characterData: true });
    } catch {
      finish();
      return;
    }
    armQuiet();
    hardTimer = setTimeout(finish, maxMs);
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
