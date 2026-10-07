import React from 'react';
import type { MarketSkills as MarketSkillsMap } from '../types/api';

export const MarketSkills = ({ marketSkills }: { marketSkills: MarketSkillsMap }) => {
  // The backend keys market_skills by canonical skill; sort by its percentage.
  const skills = Object.entries(marketSkills)
    .map(([key, data]) => ({ key, label: data.display_name || key, percentage: data.percentage }))
    .filter((s) => Number.isFinite(s.percentage))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5);

  return (
    <div className="p-4 bg-gray-50 border-t border-gray-100">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Top Market Skills</h3>
      <div className="space-y-2">
        {skills.map((s) => (
          <div key={s.key} className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700 truncate w-32" title={s.label}>{s.label}</span>
            <div className="flex-1 mx-3 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full"
                style={{ width: `${Math.min(Math.max(s.percentage, 0), 100)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-gray-600 w-10 text-right">{s.percentage}%</span>
          </div>
        ))}
        {skills.length === 0 && <p className="text-xs text-gray-500">No market data available.</p>}
      </div>
    </div>
  );
};
