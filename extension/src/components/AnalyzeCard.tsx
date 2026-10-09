import React from 'react';
import type { PageInfo } from '../popup/pageInfo';
import { AlertTriangle, Globe, Linkedin, ScanSearch } from './icons';

const primary =
  'w-full rounded-xl bg-linear-to-r from-brand-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:from-brand-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 disabled:shadow-none';

function describe(page: PageInfo): { title: string; pill: string; pillClass: string; Icon: typeof Globe } {
  switch (page.kind) {
    case 'linkedin-profile':
      return { title: 'LinkedIn profile', pill: 'Ready', pillClass: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30', Icon: Linkedin };
    case 'linkedin-skills':
      return { title: 'LinkedIn · full skills list', pill: 'Ready', pillClass: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30', Icon: Linkedin };
    case 'linkedin-other':
      return { title: 'LinkedIn · not a profile page', pill: 'Open a profile', pillClass: 'bg-amber-500/15 text-amber-300 ring-amber-500/30', Icon: Linkedin };
    case 'restricted':
      return { title: "This page can't be read", pill: 'Unavailable', pillClass: 'bg-zinc-700/40 text-zinc-300 ring-zinc-600/50', Icon: AlertTriangle };
    default:
      return { title: page.host || 'This page', pill: 'Not a profile', pillClass: 'bg-amber-500/15 text-amber-300 ring-amber-500/30', Icon: Globe };
  }
}

export const AnalyzeCard = ({
  page,
  busy,
  confirming,
  onAnalyze,
  onRequestAnyway,
  onCancelAnyway,
  onConfirmAnyway,
}: {
  page: PageInfo;
  busy: boolean;
  confirming: boolean;
  onAnalyze: () => void;
  onRequestAnyway: () => void;
  onCancelAnyway: () => void;
  onConfirmAnyway: () => void;
}) => {
  const { title, pill, pillClass, Icon } = describe(page);
  const skillsPage = page.kind === 'linkedin-skills';
  const ready = page.kind === 'linkedin-profile' || skillsPage;

  return (
    <section aria-label="Analyze this page" className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="mb-3.5 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Current page</p>
          <p className="truncate text-sm font-medium text-zinc-100">{title}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${pillClass}`}>{pill}</span>
      </div>

      {confirming ? (
        <div className="animate-pop rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
          <p className="text-[13px] leading-snug text-amber-100">
            This isn&apos;t a LinkedIn profile. SkillSync will save this page&apos;s text as your profile,{' '}
            <strong>replacing the one you have now</strong>, and no skills will be detected.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={onCancelAnyway} className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800">
              Cancel
            </button>
            <button type="button" onClick={onConfirmAnyway} className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400">
              Replace my profile
            </button>
          </div>
        </div>
      ) : (
        <>
          <button type="button" onClick={onAnalyze} disabled={!ready || busy} className={primary}>
            <span className="inline-flex items-center justify-center gap-2">
              <ScanSearch className="h-4 w-4" />
              {skillsPage ? 'Add skills from this page' : ready ? 'Analyze this profile' : 'Open a LinkedIn profile to analyze'}
            </span>
          </button>
          {skillsPage ? (
            <p className="mt-2.5 text-center text-xs text-zinc-500">Scroll to the bottom first so every skill loads. Adds them to your saved profile and re-runs the analysis.</p>
          ) : ready ? (
            <p className="mt-2.5 text-center text-xs text-zinc-500">Reads this page and saves it as your SkillSync profile.</p>
          ) : page.kind === 'other' ? (
            <button type="button" disabled={busy} onClick={onRequestAnyway} className="mt-2.5 block w-full text-center text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline">
              Analyze this page anyway…
            </button>
          ) : null}
        </>
      )}
    </section>
  );
};
