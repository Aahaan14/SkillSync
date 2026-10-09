import React, { useEffect, useState } from 'react';
import { CheckCircle } from './icons';

export type Phase = 'extracting' | 'saving' | 'analyzing';

const STEPS: Array<{ phase: Phase; label: string; hint: string }> = [
  { phase: 'extracting', label: 'Reading the page', hint: 'Collecting your experience, education and skills' },
  { phase: 'saving', label: 'Saving your profile', hint: 'Storing it in your SkillSync account' },
  { phase: 'analyzing', label: 'Analyzing the job market', hint: 'Searching live listings and scoring your skills. This can take up to a minute.' },
];

/** Seconds since mount; ticks once a second. */
function useElapsed(): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return seconds;
}

export const Loading = ({ phase }: { phase: Phase }) => {
  const elapsed = useElapsed();
  const current = STEPS.findIndex((s) => s.phase === phase);

  return (
    <section aria-live="polite" aria-label="Analysis in progress" className="animate-fade-up rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <ol className="space-y-3.5">
        {STEPS.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={step.phase} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                {done ? (
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                ) : active ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
                ) : (
                  <span className="h-3 w-3 rounded-full border border-zinc-700" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${active ? 'text-zinc-50' : done ? 'text-zinc-300' : 'text-zinc-600'}`}>{step.label}</p>
                {active && <p className="mt-0.5 text-xs leading-snug text-zinc-400">{step.hint}</p>}
              </div>
              {active && <span className="shrink-0 pt-0.5 text-xs tabular-nums text-zinc-500">{elapsed}s</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
};

/** Placeholder while the first revalidation is in flight and nothing is cached. */
export const ResultsSkeleton = () => (
  <div className="space-y-3" aria-hidden>
    <div className="h-36 animate-shimmer rounded-2xl bg-zinc-900" />
    <div className="h-48 animate-shimmer rounded-2xl bg-zinc-900" />
  </div>
);
