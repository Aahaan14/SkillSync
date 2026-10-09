import React, { useEffect, useState } from 'react';
import { formatScore, scoreTone } from '../popup/format';

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const TONES = {
  good: { stroke: '#34d399', text: 'text-emerald-400', label: 'Strong match' },
  fair: { stroke: '#fbbf24', text: 'text-amber-400', label: 'Partial match' },
  low: { stroke: '#fb7185', text: 'text-rose-400', label: 'Room to grow' },
} as const;

/**
 * Shows the backend's deterministic alignment score exactly as given; it never
 * derives or adjusts it. The counts beside it are plain list lengths. null (no
 * score) renders as an em dash, never as a fake 0%.
 */
export const MatchScore = ({
  score,
  jobsAnalyzed,
  matched,
  marketSkills,
  gaps,
}: {
  score: number | null;
  jobsAnalyzed: number;
  matched: number;
  marketSkills: number;
  gaps: number;
}) => {
  const hasScore = typeof score === 'number' && Number.isFinite(score);
  const value = hasScore ? Math.min(Math.max(score, 0), 100) : 0;
  const tone = TONES[scoreTone(value)];
  const label = hasScore ? formatScore(value) : '—';

  // Start empty, then animate to the value on mount.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);

  return (
    <section aria-label="Market alignment" className="animate-fade-up rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center gap-5">
        <div className="relative h-[116px] w-[116px] shrink-0">
          <svg viewBox="0 0 108 108" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="54" cy="54" r={RADIUS} fill="none" stroke="#27272a" strokeWidth="9" />
            {hasScore && (
              <circle
                cx="54"
                cy="54"
                r={RADIUS}
                fill="none"
                stroke={tone.stroke}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - shown / 100)}
                style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`${label.length > 4 ? 'text-[23px]' : 'text-[28px]'} font-bold leading-none tabular-nums ${hasScore ? tone.text : 'text-zinc-500'}`}>
              {label}
            </span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">alignment</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${hasScore ? tone.text : 'text-zinc-400'}`}>{hasScore ? tone.label : 'No score yet'}</p>
          <dl className="mt-2.5 space-y-1.5 text-[13px]">
            <div className="flex items-baseline justify-between"><dt className="text-zinc-400">Skills matched</dt><dd className="font-semibold tabular-nums text-emerald-300">{matched}<span className="font-normal text-zinc-500"> / {marketSkills}</span></dd></div>
            <div className="flex items-baseline justify-between"><dt className="text-zinc-400">Skill gaps</dt><dd className="font-semibold tabular-nums text-amber-300">{gaps}</dd></div>
            <div className="flex items-baseline justify-between"><dt className="text-zinc-400">Listings sampled</dt><dd className="font-semibold tabular-nums text-zinc-200">{jobsAnalyzed}</dd></div>
          </dl>
        </div>
      </div>
      <p className="mt-3.5 border-t border-zinc-800 pt-3 text-[11px] leading-snug text-zinc-500">
        Demand-weighted skill coverage of {jobsAnalyzed} sampled job listings, not the whole market.
      </p>
    </section>
  );
};
