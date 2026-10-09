import React from 'react';
import { Sparkles } from './icons';

export const EmptyState = () => (
  <section className="animate-fade-up rounded-2xl border border-dashed border-zinc-800 px-5 py-7 text-center">
    <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300">
      <Sparkles className="h-5 w-5" />
    </span>
    <h2 className="text-sm font-semibold text-zinc-100">No analysis yet</h2>
    <p className="mx-auto mt-1.5 max-w-[270px] text-[13px] leading-snug text-zinc-400">
      Open your LinkedIn profile, then analyze it to see how your skills compare with live job listings.
    </p>
    <ol className="mx-auto mt-4 max-w-[250px] space-y-1.5 text-left text-xs text-zinc-500">
      <li><span className="mr-2 font-semibold text-brand-400">1</span>Open linkedin.com/in/your-name</li>
      <li><span className="mr-2 font-semibold text-brand-400">2</span>Scroll once so every section loads</li>
      <li><span className="mr-2 font-semibold text-brand-400">3</span>Click Analyze this profile</li>
    </ol>
    <p className="mx-auto mt-4 max-w-[270px] text-[11px] leading-snug text-zinc-500">
      Tip: a profile page lists only some of your skills. Afterwards open &ldquo;Show all skills&rdquo;, scroll to the bottom and click
      &ldquo;Add skills from this page&rdquo; for a more accurate score.
    </p>
  </section>
);
