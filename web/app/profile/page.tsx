"use client";

import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Award, Briefcase, FolderGit2, GraduationCap, Link as LinkIcon, Loader2, MapPin, Pencil, Plus, Save, Trash2, User as UserIcon, X } from "lucide-react";
import { ErrorState, InlineError, LoadingState } from "@/components/States";
import { ApiError, getProfile, isApiError, saveProfile } from "@/lib/api";
import { safeHttpUrl } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import type { EducationItem, ExperienceItem, Profile, ProfileInput, SkillItem } from "@/types";

async function loadProfile(): Promise<Profile | null> {
  try {
    return await getProfile();
  } catch (error) {
    if (isApiError(error) && error.kind === "not_found") return null;
    throw error;
  }
}

export default function ProfilePage() {
  const { state, reload } = useAsync(loadProfile);
  const [editing, setEditing] = useState(false);

  if (state.status === "loading") return <LoadingState label="Loading your profile…" />;
  if (state.status === "error") return <ErrorState error={state.error} onRetry={reload} />;

  const profile = state.data;

  if (editing || !profile) {
    if (!editing) {
      return (
        <div className="p-8 max-w-3xl mx-auto mt-16">
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-10 text-center backdrop-blur-xl">
            <UserIcon className="w-14 h-14 text-zinc-600 mx-auto mb-5" />
            <h2 className="text-2xl font-bold text-zinc-200 mb-3">No profile yet</h2>
            <p className="text-zinc-400 max-w-md mx-auto mb-6">
              Capture your profile with the SkillSync Chrome extension, or create one here. Your skills drive the market comparison.
            </p>
            <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium">
              <Plus className="w-4 h-4" /> Create profile
            </button>
          </div>
        </div>
      );
    }
    return (
      <ProfileEditor
        profile={profile}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          reload();
        }}
      />
    );
  }

  return <ProfileView profile={profile} onEdit={() => setEditing(true)} />;
}

// ─── Read view ───

function Card({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-8 backdrop-blur-xl">
      <h2 className="text-lg font-semibold text-zinc-100 mb-6 flex items-center gap-2">
        {icon} {title}
      </h2>
      {children}
    </motion.section>
  );
}

function ProfileView({ profile, onEdit }: { profile: Profile; onEdit: () => void }) {
  const profileUrl = safeHttpUrl(profile.profile_url);
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-8 md:p-10 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
            <span className="text-4xl font-bold text-white">{profile.name?.charAt(0) || "U"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-3xl font-bold text-zinc-100 mb-2 break-words">{profile.name || "Unnamed profile"}</h1>
              <button type="button" onClick={onEdit} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:text-white hover:border-indigo-500/50 text-sm">
                <Pencil className="w-4 h-4" /> Edit
              </button>
            </div>
            {profile.headline && <p className="text-lg text-indigo-400 font-medium mb-4">{profile.headline}</p>}
            <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
              {profile.location && (
                <span className="flex items-center gap-1.5 bg-zinc-950/50 px-3 py-1.5 rounded-lg border border-zinc-800/50"><MapPin className="w-4 h-4" />{profile.location}</span>
              )}
              {profileUrl && (
                <a href={profileUrl} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1.5 bg-zinc-950/50 px-3 py-1.5 rounded-lg border border-zinc-800/50 hover:text-indigo-400">
                  <LinkIcon className="w-4 h-4" /> Original profile
                </a>
              )}
              {profile.source && <span className="px-3 py-1.5 rounded-lg border border-zinc-800/50">Source: {profile.source}</span>}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {profile.about && (
            <Card title="About" icon={<UserIcon className="w-5 h-5 text-indigo-400" />}>
              <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap text-sm">{profile.about}</p>
            </Card>
          )}
          {profile.experience.length > 0 && (
            <Card title="Experience" icon={<Briefcase className="w-5 h-5 text-indigo-400" />}>
              <div className="space-y-6">
                {profile.experience.map((exp, i) => (
                  <div key={i} className="relative pl-6 before:absolute before:left-0 before:top-2 before:w-2 before:h-2 before:bg-indigo-500 before:rounded-full">
                    <h3 className="font-semibold text-zinc-200">{exp.title}</h3>
                    {exp.company && <p className="text-zinc-400 text-sm mb-1">{exp.company}</p>}
                    {(exp.start_date || exp.end_date) && (
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">{exp.start_date || "?"} — {exp.end_date || "Present"}</p>
                    )}
                    {exp.description && <p className="text-sm text-zinc-400 whitespace-pre-wrap">{exp.description}</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}
          {profile.projects.length > 0 && (
            <Card title="Projects" icon={<FolderGit2 className="w-5 h-5 text-indigo-400" />}>
              <div className="space-y-4">
                {profile.projects.map((p, i) => {
                  const url = safeHttpUrl(p.url);
                  return (
                    <div key={i}>
                      <h3 className="font-medium text-zinc-200">{url ? <a href={url} target="_blank" rel="noreferrer noopener" className="hover:text-indigo-400">{p.name}</a> : p.name}</h3>
                      {p.description && <p className="text-sm text-zinc-400 whitespace-pre-wrap">{p.description}</p>}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-8">
          <Card title={`Skills (${profile.skills.length})`}>
            {profile.skills.length === 0 ? (
              <p className="text-sm text-zinc-500">No skills yet. Add some — they&apos;re what the market comparison is based on.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill, i) => (
                  <span key={`${skill.name}-${i}`} className="px-3 py-1.5 rounded-lg bg-zinc-800/50 text-zinc-300 border border-zinc-700/50 text-sm">{skill.name}</span>
                ))}
              </div>
            )}
          </Card>
          {profile.education.length > 0 && (
            <Card title="Education" icon={<GraduationCap className="w-5 h-5 text-indigo-400" />}>
              <div className="space-y-4">
                {profile.education.map((edu, i) => (
                  <div key={i} className="pb-4 border-b border-zinc-800/50 last:border-0 last:pb-0">
                    <h3 className="font-medium text-zinc-200">{edu.institution}</h3>
                    <p className="text-zinc-400 text-sm">{[edu.degree, edu.field_of_study].filter(Boolean).join(" · ")}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {profile.certifications.length > 0 && (
            <Card title="Certifications" icon={<Award className="w-5 h-5 text-indigo-400" />}>
              <ul className="space-y-3">
                {profile.certifications.map((c, i) => (
                  <li key={i} className="text-sm"><span className="text-zinc-200">{c.name}</span>{c.issuer && <span className="text-zinc-500"> — {c.issuer}</span>}</li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Editor ───

const inputClass =
  "w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50";

function Field({ label, value, onChange, error, multiline, placeholder, maxLength }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-zinc-400 mb-1.5">{label}</span>
      {multiline ? (
        <textarea className={`${inputClass} min-h-[120px]`} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={inputClass} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {error && <span className="block text-xs text-red-400 mt-1">{error}</span>}
    </label>
  );
}

const blank = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim();
  return t ? t : null;
};

function toInput(
  base: Profile | null,
  d: { name: string; headline: string; location: string; profile_url: string; about: string; skills: SkillItem[]; experience: ExperienceItem[]; education: EducationItem[] },
): ProfileInput {
  const seen = new Set<string>();
  const skills = d.skills
    .map((s) => ({ ...s, name: s.name.trim() }))
    .filter((s) => {
      const key = s.name.toLowerCase();
      if (!s.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return {
    name: blank(d.name),
    headline: blank(d.headline),
    about: blank(d.about),
    location: blank(d.location),
    profile_url: blank(d.profile_url),
    skills,
    experience: d.experience
      .filter((e) => e.title.trim() || blank(e.company) || blank(e.description))
      .map((e) => ({ title: e.title.trim(), company: blank(e.company), location: blank(e.location), start_date: blank(e.start_date), end_date: blank(e.end_date), description: blank(e.description) })),
    education: d.education
      .filter((e) => e.institution.trim() || blank(e.degree))
      .map((e) => ({ institution: e.institution.trim(), degree: blank(e.degree), field_of_study: blank(e.field_of_study), start_date: blank(e.start_date), end_date: blank(e.end_date) })),
    // Not editable on the web yet – preserved exactly as stored.
    certifications: base?.certifications ?? [],
    projects: base?.projects ?? [],
    source: base?.source ?? "manual",
  };
}

function ProfileEditor({ profile, onCancel, onSaved }: { profile: Profile | null; onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState(profile?.name ?? "");
  const [headline, setHeadline] = useState(profile?.headline ?? "");
  const [location, setLocation] = useState(profile?.location ?? "");
  const [profileUrl, setProfileUrl] = useState(profile?.profile_url ?? "");
  const [about, setAbout] = useState(profile?.about ?? "");
  const [skills, setSkills] = useState<SkillItem[]>(profile?.skills ?? []);
  const [experience, setExperience] = useState<ExperienceItem[]>(profile?.experience ?? []);
  const [education, setEducation] = useState<EducationItem[]>(profile?.education ?? []);
  const [newSkill, setNewSkill] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const addSkill = () => {
    const value = newSkill.trim();
    if (value && !skills.some((s) => s.name.toLowerCase() === value.toLowerCase())) {
      setSkills([...skills, { name: value }]);
    }
    setNewSkill("");
  };

  const patchExp = (i: number, patch: Partial<ExperienceItem>) => setExperience(experience.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const patchEdu = (i: number, patch: Partial<EducationItem>) => setEducation(education.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));

  const save = async () => {
    setError(null);
    setFieldErrors({});
    const input = toInput(profile, { name, headline, location, profile_url: profileUrl, about, skills, experience, education });
    if (input.experience.some((e) => !e.title)) return setError("Every experience entry needs a job title.");
    if (input.education.some((e) => !e.institution)) return setError("Every education entry needs an institution.");

    setSaving(true);
    try {
      await saveProfile(input);
      onSaved();
    } catch (e) {
      if (isApiError(e)) {
        setFieldErrors(e.fieldErrors);
        setError(e);
      } else {
        setError("Could not save your profile.");
      }
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">{profile ? "Edit profile" : "Create profile"}</h1>
          <p className="text-sm text-zinc-500 mt-1">Changes apply to your next analysis; existing results are not recalculated.</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={saving} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm disabled:opacity-50"><X className="w-4 h-4" /> Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      {error && <InlineError error={error} />}

      <Card title="Basics">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name" value={name} onChange={setName} error={fieldErrors.name} maxLength={100} />
          <Field label="Location" value={location} onChange={setLocation} error={fieldErrors.location} maxLength={200} />
          <div className="md:col-span-2"><Field label="Headline" value={headline} onChange={setHeadline} error={fieldErrors.headline} maxLength={500} /></div>
          <div className="md:col-span-2"><Field label="Profile URL" value={profileUrl} onChange={setProfileUrl} error={fieldErrors.profile_url} placeholder="https://" maxLength={2048} /></div>
          <div className="md:col-span-2"><Field label="About" value={about} onChange={setAbout} error={fieldErrors.about} multiline maxLength={10000} /></div>
        </div>
      </Card>

      <Card title={`Skills (${skills.length})`}>
        <div className="flex flex-wrap gap-2 mb-4">
          {skills.map((s, i) => (
            <span key={`${s.name}-${i}`} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-lg bg-zinc-800/50 text-zinc-300 border border-zinc-700/50 text-sm">
              {s.name}
              <button type="button" aria-label={`Remove ${s.name}`} onClick={() => setSkills(skills.filter((_, idx) => idx !== i))} className="p-0.5 rounded hover:bg-zinc-700"><X className="w-3.5 h-3.5" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input className={inputClass} value={newSkill} maxLength={100} placeholder="Add a skill, e.g. React" onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} />
          <button type="button" onClick={addSkill} className="px-3 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:border-indigo-500/50"><Plus className="w-4 h-4" /></button>
        </div>
      </Card>

      <Card title="Experience" icon={<Briefcase className="w-5 h-5 text-indigo-400" />}>
        <div className="space-y-6">
          {experience.map((e, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-xl border border-zinc-800/60">
              <Field label="Job title" value={e.title} onChange={(v) => patchExp(i, { title: v })} maxLength={200} error={fieldErrors[`experience.${i}.title`]} />
              <Field label="Company" value={e.company ?? ""} onChange={(v) => patchExp(i, { company: v })} maxLength={200} />
              <Field label="Start" value={e.start_date ?? ""} onChange={(v) => patchExp(i, { start_date: v })} maxLength={50} />
              <Field label="End" value={e.end_date ?? ""} onChange={(v) => patchExp(i, { end_date: v })} maxLength={50} placeholder="Present" />
              <div className="md:col-span-2"><Field label="Description" value={e.description ?? ""} onChange={(v) => patchExp(i, { description: v })} multiline maxLength={5000} /></div>
              <button type="button" onClick={() => setExperience(experience.filter((_, idx) => idx !== i))} className="md:col-span-2 justify-self-end inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /> Remove</button>
            </div>
          ))}
          <button type="button" onClick={() => setExperience([...experience, { title: "" }])} className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300"><Plus className="w-4 h-4" /> Add experience</button>
        </div>
      </Card>

      <Card title="Education" icon={<GraduationCap className="w-5 h-5 text-indigo-400" />}>
        <div className="space-y-6">
          {education.map((e, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-xl border border-zinc-800/60">
              <div className="md:col-span-2"><Field label="Institution" value={e.institution} onChange={(v) => patchEdu(i, { institution: v })} maxLength={200} error={fieldErrors[`education.${i}.institution`]} /></div>
              <Field label="Degree" value={e.degree ?? ""} onChange={(v) => patchEdu(i, { degree: v })} maxLength={200} />
              <Field label="Field of study" value={e.field_of_study ?? ""} onChange={(v) => patchEdu(i, { field_of_study: v })} maxLength={200} />
              <button type="button" onClick={() => setEducation(education.filter((_, idx) => idx !== i))} className="md:col-span-2 justify-self-end inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /> Remove</button>
            </div>
          ))}
          <button type="button" onClick={() => setEducation([...education, { institution: "" }])} className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300"><Plus className="w-4 h-4" /> Add education</button>
        </div>
      </Card>

      <p className="text-xs text-zinc-500">Certifications and projects are captured by the extension and kept as-is when you save here.</p>
    </div>
  );
}
