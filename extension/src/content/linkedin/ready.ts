import type { ExtractionReport, Profile } from '../../types';
import { parseLinkedInProfile } from './parse';

/**
 * Read the profile once the page has had a reasonable chance to render.
 *
 * LinkedIn is a single-page app: the top card, the sections and their entries
 * arrive in separate bursts after the content script starts. Reading the page the
 * instant the popup asks can therefore return a half-rendered profile.
 *
 * This waits only as long as it has to, and always for a bounded time:
 *   - If the first read already looks complete, it answers immediately.
 *   - Otherwise it listens for DOM changes (a MutationObserver, never a polling
 *     loop) and re-reads at most `maxEvaluations` times, once per `debounceMs` of
 *     changes.
 *   - It stops as soon as the page looks complete, when nothing has changed for
 *     `quietMs` (nothing more is coming), or after `maxWaitMs`, whichever is first.
 *   - It never scrolls, clicks or navigates, and it disconnects the observer when
 *     it finishes.
 */

export interface SettleOptions {
  /** Hard upper bound on the whole wait. */
  maxWaitMs?: number;
  /** Stop when the DOM has not changed for this long. */
  quietMs?: number;
  /** Re-read at most once per this interval while the DOM is changing. */
  debounceMs?: number;
  /** Upper bound on parser runs, including the first and the last. */
  maxEvaluations?: number;
}

export interface Parsed {
  profile: Profile;
  report: ExtractionReport;
}

export interface SettleEnvironment {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
  now: () => number;
  MutationObserver: typeof MutationObserver;
}

const DEFAULTS = { maxWaitMs: 5000, quietMs: 1200, debounceMs: 300, maxEvaluations: 8 };

function browserEnvironment(): SettleEnvironment {
  return {
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (id) => globalThis.clearTimeout(id as number),
    now: () => Date.now(),
    MutationObserver: globalThis.MutationObserver,
  };
}

/** Name, at least one recognised section, and no loading placeholders on a finished page. */
export function looksComplete({ report }: Parsed): boolean {
  return report.found.name && report.sections.length > 0 && report.load?.complete === true;
}

function withLoad(result: Parsed, startedAt: number, evaluations: number, timedOut: boolean, env: SettleEnvironment): Parsed {
  const load = { readyState: 'complete', loadingIndicators: false, complete: false, ...result.report.load };
  return {
    profile: result.profile,
    report: { ...result.report, load: { ...load, waitedMs: env.now() - startedAt, evaluations, timedOut } },
  };
}

export function extractWhenReady(
  doc: Document,
  url: string,
  options: SettleOptions = {},
  env: SettleEnvironment = browserEnvironment(),
): Promise<Parsed> {
  const { maxWaitMs, quietMs, debounceMs, maxEvaluations } = { ...DEFAULTS, ...options };
  const startedAt = env.now();
  let evaluations = 0;
  const evaluate = (): Parsed => {
    evaluations += 1;
    return parseLinkedInProfile(doc, url);
  };

  let latest = evaluate();
  if (looksComplete(latest)) return Promise.resolve(withLoad(latest, startedAt, evaluations, false, env));

  return new Promise<Parsed>((resolve) => {
    let finished = false;
    let dirty = false;
    let checkTimer: unknown;
    let quietTimer: unknown;
    let hardTimer: unknown;
    let observer: MutationObserver | undefined;

    const finish = (timedOut: boolean) => {
      if (finished) return;
      finished = true;
      observer?.disconnect();
      for (const timer of [checkTimer, quietTimer, hardTimer]) if (timer !== undefined) env.clearTimeout(timer);
      // One last read if the page changed after the previous one.
      if (dirty) latest = evaluate();
      resolve(withLoad(latest, startedAt, evaluations, timedOut, env));
    };

    const check = () => {
      checkTimer = undefined;
      if (finished || !dirty) return;
      dirty = false;
      latest = evaluate();
      if (looksComplete(latest)) finish(false);
      else if (evaluations >= maxEvaluations - 1) finish(true); // keep one read for the final pass
    };

    const armQuiet = () => {
      if (quietTimer !== undefined) env.clearTimeout(quietTimer);
      quietTimer = env.setTimeout(() => finish(false), quietMs);
    };

    try {
      observer = new env.MutationObserver(() => {
        dirty = true;
        armQuiet();
        if (checkTimer === undefined) checkTimer = env.setTimeout(check, debounceMs);
      });
      observer.observe(doc.body ?? doc.documentElement, { childList: true, subtree: true, characterData: true });
    } catch {
      // No observer available: fall back to the single read we already have.
      finish(false);
      return;
    }
    armQuiet();
    hardTimer = env.setTimeout(() => finish(true), maxWaitMs);
  });
}
