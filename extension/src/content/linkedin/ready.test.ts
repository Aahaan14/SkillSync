// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { extractWhenReady, looksComplete, type SettleEnvironment } from './ready';
import { PARTIAL_LOAD_PAGE, SDUI_PAGE } from './__fixtures__/profiles';

const URL = 'https://www.linkedin.com/in/riya-shah/';
const docOf = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Real timers and a real MutationObserver, but counting what the settle logic does. */
function countingEnv() {
  const counts = { observers: 0, disconnects: 0, timers: 0 };
  const env: SettleEnvironment = {
    setTimeout: (fn, ms) => {
      counts.timers += 1;
      return setTimeout(fn, ms);
    },
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
    now: () => Date.now(),
    MutationObserver: class extends MutationObserver {
      constructor(cb: MutationCallback) {
        super(cb);
        counts.observers += 1;
      }
      disconnect() {
        counts.disconnects += 1;
        super.disconnect();
      }
    },
  };
  return { env, counts };
}

const FAST = { maxWaitMs: 600, quietMs: 120, debounceMs: 30, maxEvaluations: 8 };

describe('extractWhenReady', () => {
  it('answers immediately, with a single read and no observer, when the page already looks complete', async () => {
    const { env, counts } = countingEnv();
    const result = await extractWhenReady(docOf(SDUI_PAGE), URL, FAST, env);
    expect(looksComplete(result)).toBe(true);
    expect(result.report.load).toMatchObject({ evaluations: 1, timedOut: false, complete: true });
    expect(counts.observers).toBe(0);
  });

  it('waits for sections that render late, then returns the full profile', async () => {
    const doc = docOf(PARTIAL_LOAD_PAGE);
    const full = docOf(SDUI_PAGE);
    const { env, counts } = countingEnv();
    const pending = extractWhenReady(doc, URL, FAST, env);

    await sleep(60);
    // LinkedIn replaces the placeholders with the real sections.
    doc.body.innerHTML = full.body.innerHTML;
    doc.title = full.title;

    const result = await pending;
    expect(result.profile.experience).toHaveLength(3);
    expect(result.report.sectionStatus?.experience).toBe('extracted');
    expect(result.report.load?.complete).toBe(true);
    expect(result.report.load?.timedOut).toBe(false);
    expect(counts.disconnects).toBe(counts.observers);
  });

  it('gives up after the bound with what it has, flagged as not loaded, and stops observing', async () => {
    const doc = docOf(PARTIAL_LOAD_PAGE);
    const { env, counts } = countingEnv();
    const started = Date.now();
    const result = await extractWhenReady(doc, URL, { ...FAST, maxWaitMs: 200, quietMs: 5000 }, env);
    expect(Date.now() - started).toBeLessThan(1500);
    expect(result.report.load).toMatchObject({ complete: false, timedOut: true });
    expect(result.report.sectionStatus?.experience).toBe('unavailable');
    expect(result.profile.name).toBe('Riya Shah');
    expect(counts.disconnects).toBe(counts.observers);
  });

  it('stops early when the page goes quiet instead of waiting for the full bound', async () => {
    const { env } = countingEnv();
    const started = Date.now();
    const result = await extractWhenReady(docOf(PARTIAL_LOAD_PAGE), URL, { ...FAST, maxWaitMs: 3000, quietMs: 80 }, env);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(result.report.load?.timedOut).toBe(false);
  });

  it('does not re-read on every mutation: reads are bounded by maxEvaluations', async () => {
    const doc = docOf(PARTIAL_LOAD_PAGE);
    const { env } = countingEnv();
    const pending = extractWhenReady(doc, URL, { maxWaitMs: 400, quietMs: 5000, debounceMs: 20, maxEvaluations: 4 }, env);
    // A busy page: a burst of unrelated DOM changes that never completes the profile.
    for (let i = 0; i < 40; i++) {
      doc.body.appendChild(doc.createElement('div')).textContent = `ad ${i}`;
      await sleep(5);
    }
    const result = await pending;
    expect(result.report.load?.evaluations).toBeLessThanOrEqual(4);
  });
});
