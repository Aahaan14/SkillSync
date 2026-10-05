"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AlertTriangle, BrainCircuit, Info, Loader2, RefreshCw, ServerCrash, WifiOff } from "lucide-react";
import { ApiError, createAnalysis, isApiError } from "@/lib/api";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center h-full min-h-[50vh] gap-4 text-zinc-400">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function Panel({ icon, title, children, tone = "neutral" }: { icon: ReactNode; title: string; children: ReactNode; tone?: "neutral" | "error" }) {
  const border = tone === "error" ? "border-red-500/30" : "border-zinc-800/50";
  return (
    <div className="p-8 max-w-3xl mx-auto mt-16">
      <div className={`bg-zinc-900/50 border ${border} rounded-2xl p-10 text-center backdrop-blur-xl`}>
        <div className="flex justify-center mb-5">{icon}</div>
        <h2 className="text-2xl font-bold text-zinc-200 mb-3">{title}</h2>
        <div className="text-zinc-400 max-w-md mx-auto space-y-4">{children}</div>
      </div>
    </div>
  );
}

const actionClass =
  "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export function describeError(error: ApiError): { title: string; body: string; retryable: boolean } {
  switch (error.kind) {
    case "network":
      return { title: "Can't reach the server", body: "The SkillSync backend is unavailable or your connection dropped. Please try again in a moment.", retryable: true };
    case "unauthorized":
      return { title: "Your session has expired", body: "Please sign in again to continue.", retryable: false };
    case "forbidden":
      return { title: "Access denied", body: "Your account doesn't have permission to view this.", retryable: false };
    case "not_found":
      return { title: "Not found", body: error.message, retryable: false };
    case "validation":
      return { title: "Some details are invalid", body: error.message, retryable: false };
    case "rate_limited":
      return {
        title: "Too many requests",
        body: error.retryAfterSeconds ? `Please wait about ${error.retryAfterSeconds} seconds and try again.` : "Please wait a little while and try again.",
        retryable: true,
      };
    case "server":
      return { title: "Something went wrong on our side", body: "The server hit an error. Your data is safe — please try again shortly.", retryable: true };
    case "config":
      return { title: "Dashboard misconfigured", body: error.message, retryable: false };
    default:
      return { title: "Something went wrong", body: error.message, retryable: true };
  }
}

export function ErrorState({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const { title, body, retryable } = describeError(error);
  const Icon = error.kind === "network" ? WifiOff : error.kind === "server" ? ServerCrash : AlertTriangle;
  return (
    <Panel tone="error" title={title} icon={<Icon className="w-14 h-14 text-red-400/80" />}>
      <p role="alert">{body}</p>
      <div className="flex justify-center gap-3">
        {error.kind === "unauthorized" && (
          <Link href="/" className={actionClass}>Sign in</Link>
        )}
        {retryable && onRetry && (
          <button type="button" onClick={onRetry} className={actionClass}>
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        )}
      </div>
    </Panel>
  );
}

/** Inline (non-blocking) error banner for actions such as saving or running an analysis. */
export function InlineError({ error }: { error: ApiError | string }) {
  const message = typeof error === "string" ? error : describeError(error).body;
  return (
    <div role="alert" className="text-red-300 text-sm bg-red-400/10 border border-red-400/20 p-3 rounded-lg">
      {message}
    </div>
  );
}

/** Runs a new analysis via POST /api/analysis. The backend computes everything. */
export function RunAnalysisButton({ onDone, label = "Run analysis" }: { onDone: () => void; label?: string }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      await createAnalysis();
      onDone();
    } catch (e) {
      setError(isApiError(e) ? e : new ApiError("unknown", 0, "Could not start the analysis."));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <button type="button" onClick={run} disabled={running} className={actionClass}>
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
        {running ? "Analyzing live job listings…" : label}
      </button>
      {running && <p className="text-xs text-zinc-500">This searches live job listings and can take up to a minute.</p>}
      {error && <InlineError error={error} />}
    </div>
  );
}

export function NoAnalysisState({ onDone }: { onDone: () => void }) {
  return (
    <Panel title="No analysis yet" icon={<BrainCircuit className="w-14 h-14 text-zinc-600" />}>
      <p>
        You haven&apos;t run a market analysis yet. Make sure your <Link href="/profile" className="text-indigo-400 hover:text-indigo-300 underline">profile</Link> has
        your skills, then run an analysis — or capture your profile with the SkillSync Chrome extension first.
      </p>
      <div className="flex justify-center"><RunAnalysisButton onDone={onDone} /></div>
    </Panel>
  );
}

export function AnalysisFailedState({ message, onDone }: { message: string | null; onDone: () => void }) {
  return (
    <Panel tone="error" title="Your last analysis didn't complete" icon={<AlertTriangle className="w-14 h-14 text-red-400/80" />}>
      <p role="alert">{message || "The analysis failed before results could be produced."}</p>
      <div className="flex justify-center"><RunAnalysisButton onDone={onDone} label="Try again" /></div>
    </Panel>
  );
}

export function AnalysisInProgressState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <Panel title="Analysis in progress" icon={<Loader2 className="w-14 h-14 text-indigo-400 animate-spin" />}>
      <p>Your latest analysis is still running. Refresh in a few moments to see the results.</p>
      <div className="flex justify-center">
        <button type="button" onClick={onRefresh} className={actionClass}><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>
    </Panel>
  );
}

export function NoMarketDataState({ onDone }: { onDone: () => void }) {
  return (
    <Panel title="No job listings were found" icon={<Info className="w-14 h-14 text-zinc-500" />}>
      <p>
        The analysis finished but found no job listings to compare against, so there is no market data or alignment score to show. Try adding target
        roles or a location to your profile and run it again.
      </p>
      <div className="flex justify-center"><RunAnalysisButton onDone={onDone} label="Run again" /></div>
    </Panel>
  );
}

/** Shown wherever AI content would appear but the AI layer produced nothing. */
export function AIUnavailableNotice({ className = "" }: { className?: string }) {
  return (
    <div className={`flex gap-3 items-start text-sm text-zinc-400 bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4 ${className}`}>
      <Info className="w-4 h-4 mt-0.5 shrink-0 text-zinc-500" />
      <p>
        AI enrichment isn&apos;t available for this analysis. The market data, skill gaps and alignment score shown on this page come from the
        deterministic market analysis and are not affected.
      </p>
    </div>
  );
}

/** Keeps market percentages honest: sample coverage, never outcome probabilities. */
export function MarketDisclaimer({ jobs }: { jobs: number }) {
  return (
    <p className="text-xs text-zinc-500 leading-relaxed">
      Based on {jobs} sampled job listing{jobs === 1 ? "" : "s"}, not the whole market. Percentages show how many of those listings mention a skill —
      they are not hiring, interview, salary or job-offer probabilities.
    </p>
  );
}
