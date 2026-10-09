import React, { useState } from 'react';
import type { SkillComparison } from '../types/api';
import { CheckCircle } from './icons';

const label = (entry: SkillComparison) => entry.display_name || entry.skill;
const VISIBLE = 8;

const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

/** Gaps: skills the market asks for that your profile doesn't list, most in-demand first. */
export const GapList = ({ gaps }: { gaps: SkillComparison[] }) => {
  const [all, setAll] = useState(false);
  if (!gaps.length) {
    return <p className="py-6 text-center text-sm text-zinc-400">No major skill gaps found. Nice work!</p>;
  }
  const shown = all ? gaps : gaps.slice(0, VISIBLE);
  return (
    <div>
      <ul className="space-y-3">
        {shown.map((gap, index) => (
          <li key={gap.skill}>
            <div className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-[11px] font-semibold tabular-nums text-amber-300">
                {gap.priority_rank ?? index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100" title={label(gap)}>{label(gap)}</span>
              <span className="shrink-0 text-xs tabular-nums text-zinc-400">{pct(gap.market_percentage)} of listings</span>
            </div>
            <div className="ml-[30px] mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full rounded-full bg-linear-to-r from-amber-500 to-amber-300" style={{ width: `${Math.min(Math.max(gap.market_percentage, 0), 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {gaps.length > VISIBLE && (
        <button type="button" onClick={() => setAll((a) => !a)} className="mt-3.5 w-full rounded-lg py-1.5 text-xs font-medium text-brand-400 hover:bg-zinc-800/60">
          {all ? 'Show fewer' : `Show all ${gaps.length}`}
        </button>
      )}
    </div>
  );
};

/** Strengths: market skills your profile already lists. */
export const StrengthList = ({ strengths }: { strengths: SkillComparison[] }) => {
  if (!strengths.length) {
    return <p className="py-6 text-center text-sm text-zinc-400">No matching skills found yet. Add your skills on the dashboard Profile page.</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {strengths.map((s) => (
        <li key={s.skill} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-200">
          <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
          {label(s)}
          <span className="tabular-nums text-emerald-300/60">{pct(s.market_percentage)}</span>
        </li>
      ))}
    </ul>
  );
};
