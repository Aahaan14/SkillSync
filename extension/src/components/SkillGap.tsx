import React from 'react';
import type { SkillComparison } from '../types/api';

const label = (entry: SkillComparison) => entry.display_name || entry.skill;

export const SkillGap = ({
  strengths,
  gaps,
}: {
  strengths: SkillComparison[];
  gaps: SkillComparison[];
}) => {
  return (
    <div className="p-4 bg-white">
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
          <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
          Strong Market Alignment
        </h3>
        <div className="flex flex-wrap gap-2">
          {strengths.slice(0, 5).map((s) => (
            <span key={s.skill} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-100">
              ✓ {label(s)}
            </span>
          ))}
          {strengths.length === 0 && <p className="text-xs text-gray-500">No matching skills found.</p>}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
          <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></span>
          High-Demand Gaps
        </h3>
        <div className="flex flex-wrap gap-2">
          {gaps.slice(0, 5).map((g) => (
            <span key={g.skill} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-yellow-50 text-yellow-800 border border-yellow-100">
              ⚠ {label(g)} <span className="ml-1 opacity-70">({g.market_percentage}%)</span>
            </span>
          ))}
          {gaps.length === 0 && <p className="text-xs text-gray-500">No major skill gaps identified!</p>}
        </div>
      </div>
    </div>
  );
};
