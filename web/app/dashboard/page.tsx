"use client";

import { motion } from "framer-motion";
import { Activity, Briefcase, Sparkles, Target, TrendingUp, type LucideIcon } from "lucide-react";
import { AnalysisGate } from "@/components/AnalysisGate";
import { AIUnavailableNotice, MarketDisclaimer, RunAnalysisButton } from "@/components/States";
import { formatDate, formatPercent, hasAIEnrichment, skillLabel } from "@/lib/format";
import type { Analysis } from "@/types";

export default function DashboardPage() {
  return <AnalysisGate>{(analysis, reload) => <Overview analysis={analysis} reload={reload} />}</AnalysisGate>;
}

function Overview({ analysis, reload }: { analysis: Analysis; reload: () => void }) {
  const strengths = analysis.strengths ?? [];
  const gaps = analysis.skill_gaps ?? [];
  const recognised = strengths.length + gaps.length;
  const aiAvailable = hasAIEnrichment(analysis);
  const aiScores = [
    { label: "Role fit", value: analysis.role_alignment },
    { label: "Education fit", value: analysis.education_alignment },
    { label: "Experience fit", value: analysis.experience_alignment },
  ].filter((s) => s.value !== null && s.value !== undefined);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">Overview</h1>
          <p className="text-zinc-400">Latest market analysis, generated on {formatDate(analysis.created_at)}</p>
        </div>
        <RunAnalysisButton onDone={reload} label="Re-run analysis" />
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Market Skill Alignment"
          value={formatPercent(analysis.overall_alignment_score)}
          subtitle="Demand-weighted skill coverage of the sample"
          icon={Target}
          color="text-indigo-400"
          bg="bg-indigo-400/10"
        />
        <StatCard
          title="Skills Matched"
          value={`${strengths.length} / ${recognised}`}
          subtitle="Recognised market skills on your profile"
          icon={Activity}
          color="text-emerald-400"
          bg="bg-emerald-400/10"
        />
        <StatCard
          title="Skills to Learn"
          value={String(gaps.length)}
          subtitle="Recognised market skills not on your profile"
          icon={TrendingUp}
          color="text-amber-400"
          bg="bg-amber-400/10"
        />
        <StatCard
          title="Jobs Analyzed"
          value={String(analysis.jobs_analyzed_count)}
          subtitle="Unique listings after de-duplication"
          icon={Briefcase}
          color="text-blue-400"
          bg="bg-blue-400/10"
        />
      </div>
      <MarketDisclaimer jobs={analysis.jobs_analyzed_count} />

      <section className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-8 backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-zinc-100 mb-1">Highest-demand missing skills</h2>
        <p className="text-sm text-zinc-500 mb-6">Ranked by how many sampled listings mention them.</p>
        {gaps.length === 0 ? (
          <p className="text-sm text-zinc-400">Your profile covers every skill recognised in the sampled listings.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {gaps.slice(0, 6).map((gap) => (
              <li key={gap.skill} className="flex items-center justify-between p-3 bg-zinc-950/50 border border-amber-500/10 rounded-xl">
                <span className="text-zinc-200 font-medium">{skillLabel(gap)}</span>
                <span className="text-sm text-amber-400">{formatPercent(gap.market_percentage)} of listings</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" /> AI insights
          <span className="text-xs font-normal text-zinc-500 border border-zinc-700 rounded px-2 py-0.5">AI-generated</span>
        </h2>

        {!aiAvailable ? (
          <AIUnavailableNotice />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-8 backdrop-blur-xl space-y-8"
            >
              {analysis.ai_summary && (
                <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap font-light text-lg">{analysis.ai_summary}</p>
              )}

              {(analysis.ai_relevant_roles?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">Roles that may fit</h3>
                  <div className="flex flex-wrap gap-3">
                    {analysis.ai_relevant_roles?.map((role) => (
                      <span key={role} className="px-4 py-2 rounded-lg bg-zinc-800/50 text-zinc-200 border border-zinc-700/50 text-sm font-medium">
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(analysis.ai_recommendations?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">Recommendations</h3>
                  <ul className="space-y-3">
                    {analysis.ai_recommendations?.map((rec, i) => (
                      <li key={i} className="p-4 bg-zinc-950/50 border border-zinc-800/60 rounded-xl">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="font-medium text-zinc-200">{rec.action}</span>
                          <span className="text-xs uppercase tracking-wide text-zinc-400 border border-zinc-700 rounded px-2 py-0.5">{rec.priority}</span>
                        </div>
                        <p className="text-sm text-zinc-400">{rec.reason}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-8 backdrop-blur-xl space-y-8"
            >
              {(analysis.ai_strengths?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100 mb-4">Strengths</h3>
                  <ul className="space-y-3">
                    {analysis.ai_strengths?.map((s, i) => (
                      <li key={i} className="flex gap-3 items-start text-sm text-zinc-300"><span className="text-emerald-400">✓</span>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(analysis.ai_gaps?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100 mb-4">Areas to develop</h3>
                  <ul className="space-y-3">
                    {analysis.ai_gaps?.map((g, i) => (
                      <li key={i} className="flex gap-3 items-start text-sm text-zinc-300"><span className="text-amber-400">⚠</span>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
              {aiScores.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100 mb-1">AI estimates</h3>
                  <p className="text-xs text-zinc-500 mb-3">Contextual only — not part of the alignment score.</p>
                  <dl className="space-y-2 text-sm">
                    {aiScores.map((s) => (
                      <div key={s.label} className="flex justify-between">
                        <dt className="text-zinc-400">{s.label}</dt>
                        <dd className="text-zinc-200">{formatPercent(s.value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </section>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

function StatCard({ title, value, subtitle, icon: Icon, color, bg }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6 backdrop-blur-xl flex items-start justify-between group hover:border-zinc-700/60 transition-colors"
    >
      <div>
        <p className="text-sm font-medium text-zinc-400 mb-2">{title}</p>
        <p className="text-3xl font-bold text-zinc-100">{value}</p>
        <p className="text-xs text-zinc-500 mt-2">{subtitle}</p>
      </div>
      <div className={`p-3 rounded-xl ${bg} ${color} transition-transform group-hover:scale-110`}>
        <Icon className="w-5 h-5" />
      </div>
    </motion.div>
  );
}

