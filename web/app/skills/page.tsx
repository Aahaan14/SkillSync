"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Target } from "lucide-react";
import { AnalysisGate } from "@/components/AnalysisGate";
import { MarketDisclaimer } from "@/components/States";
import { formatPercent, skillLabel } from "@/lib/format";
import type { Analysis } from "@/types";

export default function SkillsPage() {
  return <AnalysisGate>{(analysis) => <Skills analysis={analysis} />}</AnalysisGate>;
}

function clampWidth(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function Skills({ analysis }: { analysis: Analysis }) {
  const strengths = analysis.strengths ?? [];
  const gaps = analysis.skill_gaps ?? [];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Skill Gap Analysis</h1>
        <p className="text-zinc-400">Your profile compared with skills recognised in the sampled job listings.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/40 border border-emerald-500/20 rounded-2xl p-8 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400"><Target className="w-6 h-6" /></div>
            <h2 className="text-xl font-semibold text-zinc-100">Matched skills ({strengths.length})</h2>
          </div>
          <ul className="space-y-4">
            {strengths.map((s) => (
              <li key={s.skill} className="flex items-center justify-between p-4 bg-zinc-950/50 border border-emerald-500/10 rounded-xl">
                <span className="font-medium text-zinc-200">{skillLabel(s)}</span>
                <span className="text-sm px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full font-medium">
                  {formatPercent(s.market_percentage)} of listings
                </span>
              </li>
            ))}
          </ul>
          {strengths.length === 0 && <p className="text-zinc-500 text-sm">None of your profile skills matched the skills recognised in these listings.</p>}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900/40 border border-amber-500/20 rounded-2xl p-8 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400"><AlertTriangle className="w-6 h-6" /></div>
            <h2 className="text-xl font-semibold text-zinc-100">Skill gaps ({gaps.length})</h2>
          </div>
          <ul className="space-y-4">
            {gaps.map((gap) => (
              <li key={gap.skill} className="p-4 bg-zinc-950/50 border border-amber-500/10 rounded-xl">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-zinc-200">
                    {gap.priority_rank !== undefined && <span className="text-zinc-500 mr-2">#{gap.priority_rank}</span>}
                    {skillLabel(gap)}
                  </span>
                  <span className="text-sm px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full font-medium whitespace-nowrap">
                    {formatPercent(gap.market_percentage)} of listings
                  </span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-3" aria-hidden="true">
                  <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${clampWidth(gap.market_percentage)}%` }} />
                </div>
              </li>
            ))}
          </ul>
          {gaps.length === 0 && <p className="text-zinc-500 text-sm">Your profile covers every skill recognised in the sampled listings.</p>}
        </motion.section>
      </div>

      <MarketDisclaimer jobs={analysis.jobs_analyzed_count} />
    </div>
  );
}
