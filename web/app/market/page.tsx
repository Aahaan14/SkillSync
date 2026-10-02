"use client";

import { useEffect, useState } from "react";
import { getLatestAnalysis } from "@/lib/api";
import { motion } from "framer-motion";
import { Analysis } from "@/types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Search, MapPin, Briefcase } from "lucide-react";

export default function MarketPage() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLatestAnalysis()
      .then(setAnalysis)
      .catch(() => setAnalysis(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !analysis) return null;

  // Format market skills for chart
  const chartData = Object.entries(analysis.market_skills || {})
    .map(([name, data]: [string, any]) => ({
      name,
      percentage: data.percentage,
      count: data.count
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 10);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Market Intelligence</h1>
        <p className="text-zinc-400">Live job market data sampled from SerpApi Google Jobs</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Data Source Context */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-8 backdrop-blur-xl"
        >
          <h2 className="text-lg font-semibold text-zinc-100 mb-6">Data Context</h2>
          
          <div className="space-y-6">
            <div>
              <p className="text-sm text-zinc-500 mb-1">Total Jobs Analyzed</p>
              <p className="text-4xl font-bold text-indigo-400">{analysis.jobs_analyzed_count}</p>
            </div>

            <div>
              <p className="text-sm text-zinc-500 mb-3">Search Queries Used</p>
              <div className="space-y-2">
                {analysis.search_queries?.map((query, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-zinc-300 bg-zinc-800/30 p-2 rounded-lg border border-zinc-700/30">
                    <Search className="w-4 h-4 text-zinc-500" />
                    <span>{query}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
              <p className="text-xs text-indigo-300 leading-relaxed">
                This data is dynamically extracted from live Google Jobs postings matching your profile's inferred target roles. It represents the <strong>current</strong> demand, not historical trends.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Top Skills Chart */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-8 backdrop-blur-xl flex flex-col"
        >
          <h2 className="text-lg font-semibold text-zinc-100 mb-6">Top Market Skills by Demand</h2>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 40, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#a1a1aa', fontSize: 12 }} 
                />
                <Tooltip 
                  cursor={{ fill: '#27272a', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }}
                  formatter={(value: number) => [`${value}% of listings`, 'Demand']}
                />
                <Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={20}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(240, 60%, ${70 - index * 3}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
