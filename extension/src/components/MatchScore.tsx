import React from 'react';

/**
 * Shows the backend's deterministic alignment score as-is. It never derives or
 * adjusts the value; null (no score) renders as an em dash, not a fake 0%.
 */
export const MatchScore = ({
  score,
  jobsAnalyzed,
}: {
  score: number | null;
  jobsAnalyzed?: number;
}) => {
  const hasScore = typeof score === 'number' && Number.isFinite(score);
  const value = hasScore ? score : 0;

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-500';
    if (s >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getRingColor = (s: number) => {
    if (s >= 80) return 'ring-green-100 bg-green-50';
    if (s >= 60) return 'ring-yellow-100 bg-yellow-50';
    return 'ring-red-100 bg-red-50';
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 border-b border-gray-100 bg-white">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Market Alignment</h2>
      <div className={`relative flex items-center justify-center w-32 h-32 rounded-full ring-8 ${hasScore ? getRingColor(value) : 'ring-gray-100 bg-gray-50'}`}>
        <span className={`text-4xl font-bold ${hasScore ? getScoreColor(value) : 'text-gray-400'}`}>
          {hasScore ? `${Math.round(value)}%` : '—'}
        </span>
      </div>
      <p className="mt-4 text-xs text-gray-400 text-center max-w-[250px]">
        {typeof jobsAnalyzed === 'number' && jobsAnalyzed > 0
          ? `Based on ${jobsAnalyzed} sampled job listings, not the whole market.`
          : "Career Copilot's analysis based on sampled market listings."}
      </p>
    </div>
  );
};
