import React from 'react';
import type { MarketSkills as MarketSkillsMap } from '../types/api';

/** Top skills across the sampled listings. market_skills is keyed by canonical skill. */
export const MarketSkills = ({ marketSkills }: { marketSkills: MarketSkillsMap }) => {
  const skills = Object.entries(marketSkills)
    .map(([key, data]) => ({ key, name: data.display_name || key, percentage: data.percentage }))
    .filter((s) => Number.isFinite(s.percentage))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 10);

  if (!skills.length) {
    return <p className="py-6 text-center text-sm text-zinc-400">No market data available.</p>;
  }

  return (
    <ul className="space-y-3">
      {skills.map((s) => (
        <li key={s.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-medium text-zinc-100" title={s.name}>{s.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-zinc-400">{Number.isInteger(s.percentage) ? s.percentage : s.percentage.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-linear-to-r from-brand-500 to-violet-400" style={{ width: `${Math.min(Math.max(s.percentage, 0), 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
};
