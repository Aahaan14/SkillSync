"use client";

import { useEffect, useState } from "react";
import { getLatestAnalysis } from "@/lib/api";
import { motion } from "framer-motion";
import { Analysis } from "@/types";
import { Target, AlertTriangle } from "lucide-react";

export default function SkillsPage() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLatestAnalysis()
      .then(setAnalysis)
      .catch(() => setAnalysis(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !analysis) return null;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Skill Gap Analysis</h1>
        <p className="text-zinc-400">Direct comparison between your profile and market requirements</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Strengths */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/40 border border-emerald-500/20 rounded-2xl p-8 backdrop-blur-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-32 bg-emerald-500/5 rounded-full blur-[100px] -mr-16 -mt-16 pointer-events-none" />
          
          <div className="flex items-center gap-3 mb-8 relative">
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
              <Target className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-100">Verified Strengths</h2>
          </div>

          <div className="space-y-4 relative">
            {analysis.strengths?.map((strength, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-zinc-950/50 border border-emerald-500/10 rounded-xl group hover:border-emerald-500/30 transition-colors">
                <span className="font-medium text-zinc-200">{strength.skill}</span>
                <span className="text-sm px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full font-medium">
                  {strength.market_percentage}% Demand
                </span>
              </div>
            ))}
            {analysis.strengths?.length === 0 && (
              <p className="text-zinc-500 text-sm">No significant matching skills found.</p>
            )}
          </div>
        </motion.div>

        {/* Gaps */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900/40 border border-amber-500/20 rounded-2xl p-8 backdrop-blur-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-32 bg-amber-500/5 rounded-full blur-[100px] -mr-16 -mt-16 pointer-events-none" />
          
          <div className="flex items-center gap-3 mb-8 relative">
            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-100">High-Priority Gaps</h2>
          </div>

          <div className="space-y-4 relative">
            {analysis.skill_gaps?.map((gap, i) => (
              <div key={i} className="flex flex-col gap-2 p-4 bg-zinc-950/50 border border-amber-500/10 rounded-xl group hover:border-amber-500/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-200">{gap.skill}</span>
                  <span className="text-sm px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full font-medium">
                    {gap.market_percentage}% Demand
                  </span>
                </div>
                {/* Visual indicator of urgency based on percentage */}
                <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-2">
                  <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${gap.market_percentage}%` }} />
                </div>
              </div>
            ))}
            {analysis.skill_gaps?.length === 0 && (
              <p className="text-zinc-500 text-sm">You possess all top required skills for this role!</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
