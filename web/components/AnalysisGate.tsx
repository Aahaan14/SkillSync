"use client";

import type { ReactNode } from "react";
import { getLatestAnalysis, isApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import type { Analysis } from "@/types";
import {
  AnalysisFailedState,
  AnalysisInProgressState,
  ErrorState,
  LoadingState,
  NoAnalysisState,
  NoMarketDataState,
} from "./States";

/** GET /api/analysis/latest, where "no analysis yet" (404) is a normal state, not an error. */
async function loadLatestAnalysis(): Promise<Analysis | null> {
  try {
    return await getLatestAnalysis();
  } catch (error) {
    if (isApiError(error) && error.kind === "not_found") return null;
    throw error;
  }
}

/**
 * Loads the latest analysis and renders `children` only when there are
 * completed deterministic results. Every other situation (loading, error,
 * no analysis, failed, in progress, zero jobs) gets an explanatory state.
 */
export function AnalysisGate({ children }: { children: (analysis: Analysis, reload: () => void) => ReactNode }) {
  const { state, reload } = useAsync(loadLatestAnalysis);

  if (state.status === "loading") return <LoadingState label="Loading your latest analysis…" />;
  if (state.status === "error") return <ErrorState error={state.error} onRetry={reload} />;

  const analysis = state.data;
  if (!analysis) return <NoAnalysisState onDone={reload} />;
  if (analysis.status === "failed") return <AnalysisFailedState message={analysis.error_message} onDone={reload} />;
  if (analysis.status !== "completed") return <AnalysisInProgressState onRefresh={reload} />;
  if (analysis.jobs_analyzed_count === 0) return <NoMarketDataState onDone={reload} />;

  return <>{children(analysis, reload)}</>;
}
