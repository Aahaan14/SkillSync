import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  addSkillsToProfile,
  errorMessage,
  getCurrentUser,
  getLatestAnalysis,
  getProfile,
  isApiError,
  login,
  logout,
  register,
  saveProfile,
  triggerAnalysis,
} from '../api/client';
import { WEB_APP_URL } from '../api/config';
import { mergeSkills } from '../api/mergeSkills';
import { assessProfile, summarizeProfile } from '../api/profileQuality';
import { clearSession, readStoredSession, writeSnapshot, type SnapshotUser } from '../api/session';
import { AnalyzeCard } from '../components/AnalyzeCard';
import { Banner, type BannerAction, type Tone } from '../components/Banner';
import { EmptyState } from '../components/EmptyState';
import { Header } from '../components/Header';
import { Loading, ResultsSkeleton, type Phase } from '../components/Loading';
import { LoginForm, type Credentials } from '../components/LoginForm';
import { MatchScore } from '../components/MatchScore';
import { ResultTabs } from '../components/ResultTabs';
import { Sparkles } from '../components/icons';
import type { ExtractionReport, Profile } from '../types';
import type { Analysis, User } from '../types/api';
import { countSkillsOnTab, extractFromTab } from './extract';
import { formatRelative } from './format';
import { classifyPage, sameLinkedInProfile, skillsListUrl, type PageInfo } from './pageInfo';

const SESSION_EXPIRED = 'Your session has expired. Please sign in again.';

interface Notice {
  tone: Tone;
  message: string;
  action?: BannerAction;
}

type View = 'loading' | 'login' | 'home';

/** Never keep the bearer token in React state; it lives in chrome.storage only. */
const toSnapshotUser = (user: User | SnapshotUser): SnapshotUser => ({
  id: user.id,
  email: user.email,
  full_name: user.full_name,
  role: user.role,
});

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  } catch {
    return undefined;
  }
}

/** "Only N of M skills" is replaced by a dedicated banner with a one-click fix. */
const PARTIAL_SKILLS_WARNING = /^Only \d+ of \d+ skills/;

/** The profile page showed fewer skills than LinkedIn says the profile has. */
interface MoreSkills {
  have: number;
  declared: number;
  url: string;
}

/**
 * The profile page only lists a handful of skills. If the saved profile is the same
 * person's and already has more (added from the full skills list), keep them instead of
 * shrinking the profile back to what this page shows. Never merges across different people.
 */
async function withSavedSkills(profile: Profile): Promise<Profile> {
  try {
    const saved = await getProfile();
    if (!sameLinkedInProfile(saved.profile_url, profile.profile_url)) return profile;
    const merged = mergeSkills(saved.skills ?? [], profile.skills);
    return { ...profile, skills: merged.map((s) => (s.endorsements == null ? { name: s.name } : { name: s.name, endorsements: s.endorsements })) };
  } catch (err: unknown) {
    if (isApiError(err) && err.kind === 'unauthorized') throw err;
    return profile; // nothing saved yet, or the server is unreachable: save what was read
  }
}

function App() {
  const [view, setView] = useState<View>('loading');
  const [user, setUser] = useState<SnapshotUser | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState<PageInfo>({ kind: 'restricted', host: '' });

  const [phase, setPhase] = useState<Phase | null>(null);
  const [confirmAnyway, setConfirmAnyway] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [savedSummary, setSavedSummary] = useState<string | null>(null);
  const [moreSkills, setMoreSkills] = useState<MoreSkills | null>(null);
  /** Skills rendered on the LinkedIn skills-list tab: undefined while counting, null if unknown. */
  const [skillsCount, setSkillsCount] = useState<number | null | undefined>(undefined);

  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // The latest values, readable from async callbacks without stale closures.
  const analysisRef = useRef<Analysis | null>(null);
  const userRef = useRef<SnapshotUser | null>(null);
  useEffect(() => {
    analysisRef.current = analysis;
    userRef.current = user;
  }, [analysis, user]);

  const busy = phase !== null;

  /** Back to the sign-in screen, forgetting the token and cached data. */
  const expireSession = useCallback(async (message: string = SESSION_EXPIRED) => {
    await clearSession();
    setUser(null);
    setAnalysis(null);
    setNotice(null);
    setWarnings([]);
    setAuthError(message);
    setView('login');
  }, []);

  /**
   * Refresh the user and the latest analysis IN PARALLEL (they do not depend on
   * each other), keeping whatever is already on screen until the answers arrive.
   */
  const revalidate = useCallback(
    async (hadCache: boolean) => {
      setSyncing(true);
      const [me, latest] = await Promise.allSettled([getCurrentUser(), getLatestAnalysis()]);
      setSyncing(false);

      const unauthorized = (r: PromiseSettledResult<unknown>) =>
        r.status === 'rejected' && isApiError(r.reason) && r.reason.kind === 'unauthorized';
      if (unauthorized(me) || unauthorized(latest)) {
        await expireSession();
        return;
      }

      if (me.status === 'rejected') {
        setNotice({
          tone: hadCache ? 'info' : 'error',
          message: hadCache
            ? `${errorMessage(me.reason, 'Offline.')} Showing your last saved results.`
            : errorMessage(me.reason, 'Could not reach SkillSync.'),
          // Reloading the popup re-runs the whole startup (storage -> parallel revalidate).
          action: { label: 'Try again', onClick: () => window.location.reload() },
        });
        return;
      }

      const nextUser = toSnapshotUser(me.value);
      let nextAnalysis = analysisRef.current;
      if (latest.status === 'fulfilled') {
        nextAnalysis = latest.value;
      } else if (isApiError(latest.reason) && latest.reason.kind === 'not_found') {
        nextAnalysis = null; // never analysed yet
      } else {
        setNotice({ tone: 'warning', message: errorMessage(latest.reason, 'Could not refresh your latest analysis.') });
      }

      setUser(nextUser);
      setAnalysis(nextAnalysis);
      void writeSnapshot(nextUser, nextAnalysis);
    },
    [expireSession],
  );

  // First paint depends only on local storage + the active tab: no network wait.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [session, tab] = await Promise.all([readStoredSession(), getActiveTab()]);
      if (cancelled) return;
      setPage(classifyPage(tab?.url));

      if (!session.token) {
        setView('login'); // logged out: zero network calls
        return;
      }
      if (session.snapshot) {
        setUser(session.snapshot.user);
        setAnalysis(session.snapshot.analysis);
      }
      setView('home');
      await revalidate(!!session.snapshot);
    })();
    return () => {
      cancelled = true;
    };
  }, [revalidate]);

  // On the skills-list tab, tell the user how many skills are loaded before they commit.
  useEffect(() => {
    if (page.kind !== 'linkedin-skills' || view !== 'home') return;
    let cancelled = false;
    void (async () => {
      const tab = await getActiveTab();
      const count = tab ? await countSkillsOnTab(tab) : null;
      if (!cancelled) setSkillsCount(count);
    })();
    return () => {
      cancelled = true;
    };
  }, [page.kind, view]);

  // ─── auth ───

  const handleAuth = async (mode: 'login' | 'register', credentials: Credentials) => {
    setAuthBusy(true);
    setAuthError('');
    setFieldErrors({});
    try {
      const signedIn =
        mode === 'register'
          ? await register(credentials.email, credentials.password, credentials.fullName)
          : await login(credentials.email, credentials.password);
      const snapshotUser = toSnapshotUser(signedIn);
      setUser(snapshotUser);
      setAnalysis(null);
      setNotice(null);
      setView('home');
      void writeSnapshot(snapshotUser, null);
      void revalidate(false);
    } catch (err: unknown) {
      setAuthError(errorMessage(err, mode === 'register' ? 'Registration failed.' : 'Sign-in failed.'));
      if (isApiError(err)) setFieldErrors(err.fieldErrors);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // The local token and cache are cleared regardless; the server cookie expires on its own.
    }
    setUser(null);
    setAnalysis(null);
    setNotice(null);
    setWarnings([]);
    setAuthError('');
    setView('login');
  };

  // ─── analysis ───

  const copyDetails = (report: ExtractionReport) => async () => {
    let version = 'unknown';
    try {
      version = chrome.runtime.getManifest().version;
    } catch {
      // Not available outside the extension runtime.
    }
    const details = JSON.stringify({ extensionVersion: version, page: page.kind, report }, null, 2);
    try {
      await navigator.clipboard.writeText(details);
      setNotice({ tone: 'success', message: 'Diagnostic details copied. They list section names and counts only, not your profile text.' });
    } catch {
      setNotice({ tone: 'warning', message: 'Could not copy automatically. Please try again.' });
    }
  };

  const resetResults = () => {
    setNotice(null);
    setWarnings([]);
    setSavedSummary(null);
    setMoreSkills(null);
    setConfirmAnyway(false);
  };

  /** Runs one step-by-step task; turns any failure into a message (or back to sign-in on 401). */
  const guarded = async (task: () => Promise<void>, retry: () => void) => {
    try {
      await task();
    } catch (err: unknown) {
      if (isApiError(err) && err.kind === 'unauthorized') {
        await expireSession();
      } else {
        setNotice({ tone: 'error', message: errorMessage(err, 'Analysis failed.'), action: { label: 'Try again', onClick: retry } });
      }
    } finally {
      setPhase(null);
    }
  };

  /** Shared tail of every run: ask the backend for the analysis and show the outcome. */
  const analyzeSavedProfile = async (summary: string | null, pageWarnings: string[], more: MoreSkills | null) => {
    setPhase('analyzing');
    const result = await triggerAnalysis();

    // POST /analysis answers 201 even when the run failed; check the status.
    if (result.status === 'failed') {
      setNotice({ tone: 'error', message: result.error_message || 'The analysis could not be completed. Please try again.' });
      return;
    }
    if (result.status !== 'completed') {
      setNotice({ tone: 'info', message: 'The analysis is still running. Re-open the popup in a moment.' });
      return;
    }

    setAnalysis(result);
    setSavedSummary(summary);
    setWarnings(pageWarnings);
    setMoreSkills(more);
    if (userRef.current) void writeSnapshot(userRef.current, result);
  };

  const runAnalysis = async () => {
    resetResults();
    setPhase('extracting');

    await guarded(async () => {
      const tab = await getActiveTab();
      if (!tab) throw new Error('No active tab found. Open a profile page and try again.');
      const info = classifyPage(tab.url);
      setPage(info);

      const extraction = await extractFromTab(tab);
      if (!extraction.success) throw new Error(extraction.error);
      const { profile, report } = extraction;

      if (info.kind === 'linkedin-skills') {
        // The full skills list: add to the saved profile instead of replacing it.
        if (!profile.skills.length) {
          setNotice({ tone: 'error', message: 'No skills were found on this page yet. Scroll down so the list loads, then try again.' });
          return;
        }
        setPhase('saving');
        let summary: string;
        try {
          const { added, total } = await addSkillsToProfile(profile.skills);
          summary = added > 0 ? `Skills added: ${added} new, ${total} in your profile now` : `Nothing new: all skills on this page were already saved (${total} in total)`;
        } catch (err: unknown) {
          if (isApiError(err) && err.kind === 'not_found') {
            setNotice({
              tone: 'warning',
              message: 'Analyze your main LinkedIn profile page first (it saves your headline and roles), then come back here to add the rest of your skills.',
            });
            return;
          }
          throw err;
        }
        await analyzeSavedProfile(summary, [], null);
        return;
      }

      // Do not replace the saved profile with something the backend cannot analyse.
      const verdict = assessProfile(profile, report);
      if (!verdict.canAnalyze) {
        setNotice({
          tone: 'error',
          message: verdict.blockingReason ?? "Couldn't read this page.",
          action: { label: 'Copy diagnostic details', onClick: () => void copyDetails(report)() },
        });
        return;
      }

      // A profile page shows only some of the skills. Keep ones saved earlier from the full list.
      const declared = report.declaredCounts?.skills;
      const partial = declared !== undefined && profile.skills.length < declared;
      const toSave = partial ? await withSavedSkills(profile) : profile;

      setPhase('saving');
      await saveProfile(toSave);

      const url = skillsListUrl(tab.url);
      const stillMissing = partial && declared !== undefined && toSave.skills.length < declared;
      const pageWarnings = verdict.warnings.filter(
        (w) => !PARTIAL_SKILLS_WARNING.test(w) && !(toSave.skills.length > 0 && /^No skills were found/i.test(w)),
      );
      await analyzeSavedProfile(
        `Profile saved: ${summarizeProfile(toSave)}`,
        pageWarnings,
        stillMissing && url ? { have: toSave.skills.length, declared, url } : null,
      );
    }, () => void runAnalysis());
  };

  /** Re-run the analysis on the profile already saved in SkillSync (no page needed). */
  const rerunSaved = async () => {
    resetResults();
    setPhase('analyzing');
    await guarded(() => analyzeSavedProfile(null, [], null), () => void rerunSaved());
  };

  /** Take the current tab to LinkedIn's full skills list, then close the popup. */
  const openSkillsList = async (url: string) => {
    try {
      const tab = await getActiveTab();
      if (tab?.id !== undefined) {
        await chrome.tabs.update(tab.id, { url });
        window.close();
        return;
      }
    } catch {
      // Fall through to a new tab.
    }
    window.open(url, '_blank', 'noreferrer');
  };

  // ─── render ───

  if (view === 'loading') {
    return <div className="h-[600px] w-[420px] bg-zinc-950" aria-busy="true" />;
  }

  if (view === 'login') {
    return (
      <div className="flex h-[600px] w-[420px] flex-col bg-zinc-950">
        <LoginForm busy={authBusy} error={authError} fieldErrors={fieldErrors} onSubmit={handleAuth} />
      </div>
    );
  }

  const completed = analysis?.status === 'completed' ? analysis : null;
  const hasMarketData = !!completed && completed.jobs_analyzed_count > 0;

  return (
    <div className="flex h-[600px] w-[420px] flex-col bg-zinc-950">
      <Header user={user} dashboardUrl={WEB_APP_URL} onLogout={handleLogout} />

      <main className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {notice && (
          <Banner tone={notice.tone} action={notice.action} onDismiss={() => setNotice(null)}>
            {notice.message}
          </Banner>
        )}

        <AnalyzeCard
          page={page}
          busy={busy}
          skillsCount={skillsCount}
          onRerun={analysis ? () => void rerunSaved() : undefined}
          confirming={confirmAnyway}
          onAnalyze={() => void runAnalysis()}
          onRequestAnyway={() => setConfirmAnyway(true)}
          onCancelAnyway={() => setConfirmAnyway(false)}
          onConfirmAnyway={() => void runAnalysis()}
        />

        {phase ? (
          <Loading phase={phase} flow={page.kind === 'linkedin-skills' ? 'skills' : 'profile'} />
        ) : (
          <>
            {savedSummary && (
              <Banner tone="success" onDismiss={() => setSavedSummary(null)}>
                {savedSummary}
              </Banner>
            )}
            {moreSkills && (
              <Banner
                tone="warning"
                onDismiss={() => setMoreSkills(null)}
                action={{ label: 'Open full skills list', onClick: () => void openSkillsList(moreSkills.url) }}
              >
                Only {moreSkills.have} of your {moreSkills.declared} LinkedIn skills could be read, so the score may be too low. Open the full list,
                scroll to the bottom, then click &ldquo;Add skills from this page&rdquo;.
              </Banner>
            )}
            {warnings.length > 0 && (
              <Banner
                tone="warning"
                onDismiss={() => setWarnings([])}
                action={{ label: 'Open Profile page', onClick: () => window.open(`${WEB_APP_URL}/profile`, '_blank', 'noreferrer') }}
              >
                {warnings.length === 1 ? (
                  warnings[0]
                ) : (
                  <ul className="list-disc space-y-1 pl-4">
                    {warnings.slice(0, 3).map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
              </Banner>
            )}

            {completed && hasMarketData ? (
              <>
                <MatchScore
                  score={completed.overall_alignment_score}
                  jobsAnalyzed={completed.jobs_analyzed_count}
                  matched={(completed.strengths ?? []).length}
                  marketSkills={Object.keys(completed.market_skills ?? {}).length}
                  gaps={(completed.skill_gaps ?? []).length}
                />
                <ResultTabs analysis={completed} />
                {completed.ai_summary && (
                  <section aria-label="AI insights" className="animate-fade-up rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-brand-400" />
                      <h2 className="text-sm font-semibold text-zinc-100">AI insights</h2>
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">AI-generated</span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-zinc-300">{completed.ai_summary}</p>
                  </section>
                )}
              </>
            ) : completed ? (
              <p className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 text-center text-sm leading-snug text-zinc-400">
                The last analysis found no job listings, so there is nothing to compare against yet. Try again in a moment.
              </p>
            ) : analysis?.status === 'failed' ? (
              <Banner tone="error">
                Your last analysis failed: {analysis.error_message || 'please try again.'}
              </Banner>
            ) : analysis ? (
              <Banner tone="info">An analysis is still in progress. Re-open the popup in a moment.</Banner>
            ) : syncing ? (
              <ResultsSkeleton />
            ) : (
              <EmptyState />
            )}
          </>
        )}
      </main>

      <footer className="flex h-11 shrink-0 items-center justify-between border-t border-zinc-800/80 px-4 text-xs text-zinc-500">
        <span aria-live="polite">
          {syncing ? 'Updating…' : analysis ? `Analyzed ${formatRelative(analysis.created_at)}` : 'Not analyzed yet'}
        </span>
        <a href={WEB_APP_URL} target="_blank" rel="noreferrer" className="font-medium text-brand-400 hover:text-brand-300">
          Open full dashboard ↗
        </a>
      </footer>
    </div>
  );
}

export default App;
