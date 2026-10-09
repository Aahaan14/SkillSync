import type { SkillItem } from '../../types';

/**
 * Pieces shared by the structural parser (parse.ts) and the text parser
 * (textParse.ts): section names, date/skills patterns and small string helpers.
 */

export type SectionKind = 'about' | 'experience' | 'education' | 'skills' | 'certifications' | 'projects';

export const SECTION_HEADINGS: Array<[SectionKind, RegExp]> = [
  ['about', /^about$/i],
  ['experience', /^experience$/i],
  ['education', /^education$/i],
  ['skills', /^(top )?skills$/i],
  ['certifications', /^licen[sc]es\s*(&|and)\s*certifications?/i],
  ['projects', /^projects$/i],
];

export const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
export const DATE_RANGE = new RegExp(
  `^((?:${MONTH}\\s+)?(?:19|20)\\d{2})\\s*[-–—]\\s*(present|(?:${MONTH}\\s+)?(?:19|20)\\d{2})`,
  'i',
);
export const SINGLE_YEAR = /^((?:19|20)\d{2})$/;
export const SKILLS_LINE = /(\+\s*\d+\s+skills?\s*$)|(^skills:\s*)/i;
export const NOISE_LINES = /^(show all|see more|…\s*see more|\.\.\.\s*see more|show credential|see credential|more|following|follow)$/i;

// ─── text helpers ───

export const clean = (value: string | null | undefined): string =>
  (value ?? '').replace(/\s+/g, ' ').trim();


export function kindOf(text: string): SectionKind | null {
  for (const [kind, pattern] of SECTION_HEADINGS) {
    if (pattern.test(text)) return kind;
  }
  return null;
}


export function parseDates(line: string): { start?: string; end?: string } | null {
  const range = DATE_RANGE.exec(line);
  if (range) return { start: clean(range[1]), end: clean(range[2]) };
  const year = SINGLE_YEAR.exec(line);
  if (year) return { end: year[1] };
  return null;
}

/** "Graphic Design, Logo Design and +3 skills" -> ["Graphic Design", "Logo Design"] */
export function parseSkillsLine(line: string): string[] | null {
  if (!SKILLS_LINE.test(line)) return null;
  const body = line
    .replace(/^skills:\s*/i, '')
    .replace(/\s*(and\s+)?\+\s*\d+\s+skills?\s*$/i, '');
  return body
    .split(/,|\s+and\s+/i)
    .map(clean)
    .filter((s) => s.length > 0 && s.length <= 100);
}

export function looksLikeLocation(line: string): boolean {
  return (
    line.length <= 80 && (/,/.test(line) || /\b(area|remote|on-site|hybrid)\b/i.test(line)) && !/\d{4}/.test(line)
  );
}


export const TOP_CARD_NOISE =
  /^(·\s*)?(1st|2nd|3rd\+?|message|connect|follow|more|contact info|open to|add profile section|enhance profile|resources|save in sales navigator|pending|\(.*\))$|connections?$|followers?$|^\d+\+?$/i;


export function uniqueSkills(...groups: Array<Array<string | SkillItem>>): SkillItem[] {
  const seen = new Set<string>();
  const out: SkillItem[] = [];
  for (const group of groups) {
    for (const entry of group) {
      const item = typeof entry === 'string' ? { name: entry } : entry;
      const key = item.name.toLowerCase();
      if (!item.name || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

