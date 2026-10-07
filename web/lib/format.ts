import type { Analysis, MarketSkill } from '../types';

export function skillLabel(entry: { skill: string; display_name?: string | null }): string {
  return entry.display_name || entry.skill;
}

export function marketSkillLabel(key: string, skill: MarketSkill): string {
  return skill.display_name || key;
}

/** Formats a backend-provided percentage (0-100). Never derives a value. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'an unknown date';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'an unknown date' : date.toLocaleDateString();
}

/** True when at least one AI enrichment field holds content. */
export function hasAIEnrichment(analysis: Analysis): boolean {
  return Boolean(
    analysis.ai_summary?.trim() ||
      analysis.ai_strengths?.length ||
      analysis.ai_gaps?.length ||
      analysis.ai_recommendations?.length ||
      analysis.ai_relevant_roles?.length ||
      analysis.ai_roadmap?.length,
  );
}

/** Returns the URL only if it is plain http(s); guards against javascript:/data: links. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
