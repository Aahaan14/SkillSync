import React from 'react';

export const MatchScore = ({ score }: { score: number }) => {
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
      <div className={`relative flex items-center justify-center w-32 h-32 rounded-full ring-8 ${getRingColor(score)}`}>
        <span className={`text-4xl font-bold ${getScoreColor(score)}`}>
          {Math.round(score)}%
        </span>
      </div>
      <p className="mt-4 text-xs text-gray-400 text-center max-w-[250px]">
        Career Copilot's analysis based on sampled market listings.
      </p>
    </div>
  );
};
