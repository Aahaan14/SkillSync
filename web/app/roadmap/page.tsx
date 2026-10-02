"use client";

import { useEffect, useState } from "react";
import { getLatestAnalysis } from "@/lib/api";
import { motion } from "framer-motion";
import { Analysis } from "@/types";
import { BookOpen, CheckCircle, ArrowRight, Clock } from "lucide-react";

export default function RoadmapPage() {
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
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <header className="mb-12 text-center">
        <div className="inline-flex items-center justify-center p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 mb-6">
          <BookOpen className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-4">Learning Roadmap</h1>
        <p className="text-zinc-400 max-w-2xl mx-auto">
          AI-generated action plan designed specifically to close your highest-priority market skill gaps.
        </p>
      </header>

      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-zinc-800 before:to-transparent">
        {analysis.ai_roadmap?.map((step: { milestone: string; timeframe?: string; description: string; actions?: string[] }, index: number) => (
          <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            {/* Timeline dot */}
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-zinc-950 bg-indigo-500 text-zinc-100 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
              <span className="text-sm font-bold">{index + 1}</span>
            </div>
            
            {/* Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 backdrop-blur-xl hover:border-indigo-500/30 transition-colors shadow-xl"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-lg text-zinc-100">{step.milestone || `Step ${index + 1}`}</h3>
                {step.timeframe && (
                  <span className="flex items-center gap-1 text-xs font-medium text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded-md">
                    <Clock className="w-3 h-3" />
                    {step.timeframe}
                  </span>
                )}
              </div>
              
              <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                {step.description}
              </p>
              
              {step.actions && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Action Items</h4>
                  {step.actions.map((action: string, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                      <span className="text-sm text-zinc-300">{action}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}
