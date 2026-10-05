"use client";

import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AnalysisGate } from "@/components/AnalysisGate";
import { MarketDisclaimer } from "@/components/States";
import { formatDate, formatPercent, marketSkillLabel } from "@/lib/format";
import type { Analysis } from "@/types";

export default function MarketPage() {
  return <AnalysisGate>{(analysis) => <Market analysis={analysis} />}</AnalysisGate>;
}

function Market({ analysis }: { analysis: Analysis }) {
  const ownedSkills = new Set((analysis.strengths ?? []).map((s) => s.skill));

  const skills = Object.entries(analysis.market_skills ?? {})
    .map(([key, data]) => ({
      key,
      name: marketSkillLabel(key, data),
      percentage: data.percentage,
      count: data.jobs_requiring ?? data.count,
      owned: ownedSkills.has(key),
    }))
    .sort((a, b) => b.percentage - a.percentage || a.name.localeCompare(b.name));

  const chartData = skills.slice(0, 10);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Market Intelligence</h1>
        <p className="text-zinc-400">
          Job listings sampled from Google Jobs (via SerpApi) for your latest analysis on {formatDate(analysis.created_at)}.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-8 backdrop-blur-xl"
        >
          <h2 className="text-lg font-semibold text-zinc-100 mb-6">Data Context</h2>
          <div className="space-y-6">
            <div>
              <p className="text-sm text-zinc-500 mb-1">Unique jobs analyzed</p>
              <p className="text-4xl font-bold text-indigo-400">{analysis.jobs_analyzed_count}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500 mb-3">Search queries used</p>
              {(analysis.search_queries?.length ?? 0) === 0 ? (
                <p className="text-sm text-zinc-500">No queries recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {analysis.search_queries?.map((query) => (
                    <li key={query} className="flex items-center gap-2 text-sm text-zinc-300 bg-zinc-800/30 p-2 rounded-lg border border-zinc-700/30">
                      <Search className="w-4 h-4 text-zinc-500 shrink-0" />
                      <span className="break-words min-w-0">{query}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
              <MarketDisclaimer jobs={analysis.jobs_analyzed_count} />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-8 backdrop-blur-xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="text-lg font-semibold text-zinc-100">Top skills by listing frequency</h2>
            <div className="flex items-center gap-4 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-500" /> On your profile</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500" /> Not on your profile</span>
            </div>
          </div>

          {chartData.length === 0 ? (
            <p className="text-sm text-zinc-400">No recognised skills were found in the sampled listings.</p>
          ) : (
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 40, bottom: 0 }}>
                  <XAxis type="number" hide domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={110} tick={{ fill: "#a1a1aa", fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: "#27272a", opacity: 0.4 }}
                    contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px", color: "#f4f4f5" }}
                    formatter={(value) => [`${value}% of sampled listings`, "Frequency"]}
                  />
                  <Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={20}>
                    {chartData.map((entry) => (
                      <Cell key={entry.key} fill={entry.owned ? "#6366f1" : "#f59e0b"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      </div>

      {skills.length > 0 && (
        <section className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-8 backdrop-blur-xl">
          <h2 className="text-lg font-semibold text-zinc-100 mb-6">All recognised skills ({skills.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="py-2 pr-4 font-medium">Skill</th>
                  <th className="py-2 pr-4 font-medium">Listings</th>
                  <th className="py-2 pr-4 font-medium">Share of sample</th>
                  <th className="py-2 font-medium">On your profile</th>
                </tr>
              </thead>
              <tbody>
                {skills.map((s) => (
                  <tr key={s.key} className="border-b border-zinc-800/50 last:border-0">
                    <td className="py-2 pr-4 text-zinc-200">{s.name}</td>
                    <td className="py-2 pr-4 text-zinc-400">{s.count}</td>
                    <td className="py-2 pr-4 text-zinc-400">{formatPercent(s.percentage)}</td>
                    <td className="py-2">{s.owned ? <span className="text-emerald-400">Yes</span> : <span className="text-zinc-500">No</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
