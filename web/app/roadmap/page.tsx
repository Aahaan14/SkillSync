"use client";

import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { AnalysisGate } from "@/components/AnalysisGate";
import { AIUnavailableNotice } from "@/components/States";
import { formatPercent, hasAIEnrichment, skillLabel } from "@/lib/format";
import type { Analysis } from "@/types";

export default function RoadmapPage() {
  return <AnalysisGate>{(analysis) => <Roadmap analysis={analysis} />}</AnalysisGate>;
}

function Roadmap({ analysis }: { analysis: Analysis }) {
  const roadmap = analysis.ai_roadmap ?? [];
  const gaps = analysis.skill_gaps ?? [];

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <header className="text-center">
        <div className="inline-flex items-center justify-center p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 mb-6">
          <BookOpen className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-4">Learning Roadmap</h1>
        <p className="text-zinc-400 max-w-2xl mx-auto">
          An AI-generated suggestion for which missing skills to learn, based on the gaps found in your latest analysis. It is guidance, not a guarantee of any hiring outcome.
        </p>
      </header>

      {roadmap.length > 0 ? (
        <ol className="space-y-4">
          {roadmap.map((item, index) => (
            <motion.li
              key={`${item.skill}-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex gap-4 p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 backdrop-blur-xl"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500 text-zinc-100 shrink-0 text-sm font-bold">{index + 1}</div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h2 className="font-bold text-lg text-zinc-100">{item.skill}</h2>
                  <span className="text-xs text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded-md">AI priority {item.priority}</span>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed">{item.reasoning}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      ) : (
        <div className="space-y-6">
          {!hasAIEnrichment(analysis) ? (
            <AIUnavailableNotice />
          ) : (
            <p className="text-sm text-zinc-400 bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4">
              The AI did not produce a roadmap for this analysis.
            </p>
          )}

          {gaps.length > 0 && (
            <section className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-8 backdrop-blur-xl">
              <h2 className="text-lg font-semibold text-zinc-100 mb-1">Where to start</h2>
              <p className="text-sm text-zinc-500 mb-6">Your most frequently requested missing skills, from the market analysis.</p>
              <ol className="space-y-3">
                {gaps.slice(0, 5).map((gap, i) => (
                  <li key={gap.skill} className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/60">
                    <span className="text-zinc-200"><span className="text-zinc-500 mr-2">{i + 1}.</span>{skillLabel(gap)}</span>
                    <span className="text-sm text-amber-400">{formatPercent(gap.market_percentage)} of listings</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
