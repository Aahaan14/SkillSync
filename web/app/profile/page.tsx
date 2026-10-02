"use client";

import { useEffect, useState } from "react";
import { getProfile } from "@/lib/api";
import { Profile } from "@/types";
import { User, MapPin, Link as LinkIcon, Briefcase, GraduationCap, Award } from "lucide-react";
import { motion } from "framer-motion";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  if (!profile) {
    return (
      <div className="p-8 max-w-4xl mx-auto mt-20">
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-12 text-center backdrop-blur-xl">
          <User className="w-16 h-16 text-zinc-600 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-zinc-200 mb-4">No Profile Found</h2>
          <p className="text-zinc-400 mb-8 max-w-md mx-auto">
            Please use the SkillSync Chrome Extension to extract and save your professional profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header Profile Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-8 md:p-10 backdrop-blur-xl mb-8 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row gap-8 items-start relative">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <span className="text-4xl font-bold text-white">{profile.name?.charAt(0) || 'U'}</span>
          </div>
          
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-zinc-100 mb-2">{profile.name}</h1>
            <p className="text-lg text-indigo-400 font-medium mb-4">{profile.headline}</p>
            
            <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
              {profile.location && (
                <div className="flex items-center gap-1.5 bg-zinc-950/50 px-3 py-1.5 rounded-lg border border-zinc-800/50">
                  <MapPin className="w-4 h-4" />
                  {profile.location}
                </div>
              )}
              {profile.profile_url && (
                <a href={profile.profile_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 bg-zinc-950/50 px-3 py-1.5 rounded-lg border border-zinc-800/50 hover:text-indigo-400 hover:border-indigo-500/30 transition-colors">
                  <LinkIcon className="w-4 h-4" />
                  View Original Profile
                </a>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* About */}
          {profile.about && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-8 backdrop-blur-xl"
            >
              <h2 className="text-xl font-semibold text-zinc-100 mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-400" /> About
              </h2>
              <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap text-sm">
                {profile.about}
              </p>
            </motion.section>
          )}

          {/* Experience */}
          {profile.experience && profile.experience.length > 0 && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-8 backdrop-blur-xl"
            >
              <h2 className="text-xl font-semibold text-zinc-100 mb-6 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-400" /> Experience
              </h2>
              <div className="space-y-6">
                {profile.experience.map((exp: any, i: number) => (
                  <div key={i} className="relative pl-6 before:absolute before:left-0 before:top-2 before:w-2 before:h-2 before:bg-indigo-500 before:rounded-full before:ring-4 before:ring-zinc-900/50">
                    <h3 className="font-semibold text-zinc-200">{exp.title}</h3>
                    <p className="text-zinc-400 text-sm mb-2">{exp.company}</p>
                    {(exp.start_date || exp.end_date) && (
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                        {exp.start_date || '?'} — {exp.end_date || 'Present'}
                      </p>
                    )}
                    {exp.description && (
                      <p className="text-sm text-zinc-400 mt-2">{exp.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </motion.section>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          
          {/* Skills */}
          {profile.skills && profile.skills.length > 0 && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-8 backdrop-blur-xl"
            >
              <h2 className="text-lg font-semibold text-zinc-100 mb-6">Skills ({profile.skills.length})</h2>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill: any, i: number) => (
                  <span key={i} className="px-3 py-1.5 rounded-lg bg-zinc-800/50 text-zinc-300 border border-zinc-700/50 text-sm">
                    {skill.name}
                  </span>
                ))}
              </div>
            </motion.section>
          )}

          {/* Education */}
          {profile.education && profile.education.length > 0 && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-8 backdrop-blur-xl"
            >
              <h2 className="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-400" /> Education
              </h2>
              <div className="space-y-4">
                {profile.education.map((edu: any, i: number) => (
                  <div key={i} className="pb-4 border-b border-zinc-800/50 last:border-0 last:pb-0">
                    <h3 className="font-medium text-zinc-200">{edu.institution}</h3>
                    <p className="text-zinc-400 text-sm">{edu.degree}</p>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

        </div>
      </div>
    </div>
  );
}
