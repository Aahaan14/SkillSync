import React from 'react';

export const MarketSkills = ({ marketSkills }: { marketSkills: Record<string, any> }) => {
  // Convert dict to array and sort by percentage
  const skills = Object.entries(marketSkills || {})
    .map(([skill, data]) => ({ skill, ...data }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5);

  return (
    <div className="p-4 bg-gray-50 border-t border-gray-100">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Top Market Skills</h3>
      <div className="space-y-2">
        {skills.map((s, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700 truncate w-32" title={s.skill}>{s.skill}</span>
            <div className="flex-1 mx-3 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-brand-500 rounded-full" 
                style={{ width: `${Math.min(s.percentage, 100)}%` }}
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
