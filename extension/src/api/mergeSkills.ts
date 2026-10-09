import type { SkillItem } from '../types/api';
import { PROFILE_LIMITS } from './profilePayload';

/**
 * Saved skills first (their order is kept), then any skill from `found` that is not
 * already there. Names are compared ignoring case, and the result respects the
 * backend's limits so the PUT cannot fail with a 422.
 */
export function mergeSkills(saved: SkillItem[], found: Array<{ name: string; endorsements?: number | null }>): SkillItem[] {
  const seen = new Set<string>();
  const out: SkillItem[] = [];
  for (const entry of [...saved, ...found]) {
    const name = (entry.name ?? '').trim().slice(0, PROFILE_LIMITS.skill_name);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push({ name, endorsements: entry.endorsements ?? null });
    if (out.length >= PROFILE_LIMITS.skills) break;
  }
  return out;
}
