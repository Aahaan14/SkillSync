import React, { useState } from 'react';
import type { Analysis } from '../types/api';
import { MarketSkills } from './MarketSkills';
import { GapList, StrengthList } from './SkillGap';

type Tab = 'gaps' | 'strengths' | 'market';

/** Segmented Gaps / Strengths / Market view of one completed analysis. */
export const ResultTabs = ({ analysis }: { analysis: Analysis }) => {
  const [tab, setTab] = useState<Tab>('gaps');
  const gaps = analysis.skill_gaps ?? [];
  const strengths = analysis.strengths ?? [];
  const market = analysis.market_skills ?? {};

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'gaps', label: 'Gaps', count: gaps.length },
    { id: 'strengths', label: 'Strengths', count: strengths.length },
    { id: 'market', label: 'Market', count: Object.keys(market).length },
  ];

  return (
    <section aria-label="Skill details" className="animate-fade-up rounded-2xl border border-zinc-800 bg-zinc-900/60">
      <div role="tablist" aria-label="Result sections" className="m-2 flex gap-1 rounded-xl bg-zinc-950/70 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${tab === t.id ? 'bg-zinc-800 text-zinc-50 shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            {t.label} <span className={`ml-0.5 tabular-nums ${tab === t.id ? 'text-brand-300' : 'text-zinc-600'}`}>{t.count}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="px-4 pb-4 pt-2">
        {tab === 'gaps' && <GapList gaps={gaps} />}
        {tab === 'strengths' && <StrengthList strengths={strengths} />}
        {tab === 'market' && <MarketSkills marketSkills={market} />}
      </div>
    </section>
  );
};
