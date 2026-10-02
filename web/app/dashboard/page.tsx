"use client";

import { useEffect, useState } from "react";
import { getLatestAnalysis } from "@/lib/api";
import { motion } from "framer-motion";
import { Briefcase, Target, BrainCircuit, Activity } from "lucide-react";
import { Analysis } from "@/types";

export default function DashboardPage() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLatestAnalysis()
      .then(setAnalysis)
      .catch(() => setAnalysis(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="p-8 max-w-4xl mx-auto mt-20">
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-12 text-center backdrop-blur-xl">
          <BrainCircuit className="w-16 h-16 text-zinc-600 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-zinc-200 mb-4">No Analysis Found</h2>
          <p className="text-zinc-400 mb-8 max-w-md mx-auto">
            You haven't run a market analysis yet. Use the SkillSync Chrome Extension on your professional profile to generate your first insights.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Overview</h1>
        <p className="text-zinc-400">Your latest career market intelligence, generated on {new Date(analysis.created_at).toLocaleDateString()}</p>
      </header>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
          title="Overall Alignment" 
          value={`${analysis.overall_alignment_score}%`}
          subtitle="Match with market"
          icon={Target}
          color="text-indigo-400"
          bg="bg-indigo-400/10"
        />
        <StatCard 
          title="Skill Match" 
          value={`${analysis.skill_alignment}%`}
          subtitle="Required skills present"
          icon={Activity}
          color="text-emerald-400"
          bg="bg-emerald-400/10"
        />
        <StatCard 
          title="Jobs Analyzed" 
          value={analysis.jobs_analyzed_count.toString()}
          subtitle="From live SerpApi data"
          icon={Briefcase}
          color="text-blue-400"
          bg="bg-blue-400/10"
        />
        <StatCard 
          title="Role Fit" 
          value={`${analysis.role_alignment}%`}
          subtitle="Title & experience"
          icon={BrainCircuit}
          color="text-purple-400"
          bg="bg-purple-400/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        {/* Main AI Summary */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-8 backdrop-blur-xl"
        >
          <h2 className="text-xl font-semibold text-zinc-100 mb-6 flex items-center gap-2">
            <SparkleIcon /> AI Executive Summary
          </h2>
          <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap font-light text-lg">
            {analysis.ai_summary}
          </p>

          <div className="mt-8 pt-6 border-t border-zinc-800/50">
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">Recommended Next Roles</h3>
            <div className="flex flex-wrap gap-3">
              {analysis.ai_relevant_roles?.map((role, i) => (
                <span key={i} className="px-4 py-2 rounded-lg bg-zinc-800/50 text-zinc-200 border border-zinc-700/50 text-sm font-medium">
                  {role}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Quick Highlights */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-8 backdrop-blur-xl"
        >
          <h2 className="text-lg font-semibold text-zinc-100 mb-6">Key Strengths</h2>
          <ul className="space-y-4 mb-8">
            {analysis.ai_strengths?.map((strength, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="text-emerald-400 mt-1">✓</span>
                <span className="text-zinc-300 text-sm">{strength}</span>
              </li>
            ))}
          </ul>

          <h2 className="text-lg font-semibold text-zinc-100 mb-6 border-t border-zinc-800/50 pt-6">Critical Gaps</h2>
          <ul className="space-y-4">
            {analysis.ai_gaps?.map((gap, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="text-amber-400 mt-1">⚠</span>
                <span className="text-zinc-300 text-sm">{gap}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: any; // Lucide icon
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

const SparkleIcon = () => (
  <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);
