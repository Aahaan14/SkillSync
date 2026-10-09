// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_TOKEN_STORAGE_KEY } from '../api/config';
import type { ExtractionResponse, Profile } from '../types';
import type { Analysis } from '../types/api';
import App from './App';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SNAPSHOT_KEY = 'skillsync_snapshot_v1';
const USER = { id: 1, email: 'jane@example.com', full_name: 'Jane Doe', role: 'user' as const };
const FULL_USER = { ...USER, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', access_token: null };

const ANALYSIS: Analysis = {
  id: 7,
  status: 'completed',
  jobs_analyzed_count: 45,
  market_skills: {
    aws: { canonical_skill: 'aws', display_name: 'AWS', count: 21, jobs_requiring: 21, percentage: 46.7 },
    python: { canonical_skill: 'python', display_name: 'Python', count: 39, jobs_requiring: 39, percentage: 86.7 },
  },
  strengths: [{ skill: 'python', display_name: 'Python', market_percentage: 86.7, status: 'strong', priority_rank: null }],
  skill_gaps: [{ skill: 'aws', display_name: 'AWS', market_percentage: 46.7, status: 'missing', priority_rank: 1 }],
  overall_alignment_score: 32.6,
  skill_alignment: 32.6,
  role_alignment: null,
  education_alignment: null,
  experience_alignment: null,
  ai_summary: null,
  ai_strengths: null,
  ai_gaps: null,
  ai_recommendations: null,
  ai_relevant_roles: null,
  ai_roadmap: null,
  search_queries: ['ml engineer jobs'],
  error_message: null,
  created_at: '2026-10-08T09:30:00Z',
  updated_at: '2026-10-08T09:30:00Z',
};

const PROFILE: Profile = {
  name: 'Jane Doe',
  headline: 'ML Engineer',
  profile_url: 'https://www.linkedin.com/in/jane/',
  source: 'linkedin',
  skills: [{ name: 'Python' }],
  experience: [{ title: 'ML Engineer', company: 'Acme' }],
  education: [],
  certifications: [],
  projects: [],
};
const REPORT = {
  source: 'linkedin' as const,
  found: { name: true, headline: true, location: false, about: false },
  counts: { skills: 1, experience: 1, education: 0, certifications: 0, projects: 0 },
  sections: ['experience'],
  otherHeadings: [],
  warnings: [],
};

interface Harness {
  store: Record<string, unknown>;
  calls: string[];
  sendMessage: ReturnType<typeof vi.fn>;
}

type Route = (method: string) => Promise<Response> | Response;

function respond(status: number, body: unknown, delayMs = 0): Promise<Response> {
  return new Promise((resolve) =>
    setTimeout(() => resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })), delayMs),
  );
}

function setup(options: {
  store?: Record<string, unknown>;
  tabUrl?: string;
  routes?: Record<string, Route>;
  extraction?: ExtractionResponse;
}): Harness {
  const store: Record<string, unknown> = { ...(options.store ?? {}) };
  const calls: string[] = [];
  const sendMessage = vi.fn(async () => options.extraction ?? { success: true, profile: PROFILE, report: REPORT });

  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (keys: string | string[]) =>
          Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter((k) => k in store).map((k) => [k, store[k]])),
        set: async (items: Record<string, unknown>) => void Object.assign(store, items),
        remove: async (keys: string | string[]) => void (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]),
      },
    },
    tabs: { query: async () => [{ id: 1, url: options.tabUrl ?? 'https://www.linkedin.com/in/jane-doe/' }], sendMessage },
    scripting: { executeScript: vi.fn(async () => undefined) },
    runtime: { getManifest: () => ({ version: '1.2.3' }) },
  });

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const path = String(url).replace(/^https?:\/\/[^/]+/, '');
      calls.push(`${method} ${path}`);
      const route = options.routes?.[path];
      return route ? route(method) : respond(500, { detail: `unmocked ${path}` });
    }),
  );
  return { store, calls, sendMessage };
}

const signedIn = (analysis: Analysis | null = ANALYSIS) => ({
  [ACCESS_TOKEN_STORAGE_KEY]: 'tok',
  [SNAPSHOT_KEY]: { user: USER, analysis, savedAt: 1 },
});

let container: HTMLDivElement;
let root: Root;

async function mount() {
  await act(async () => {
    root.render(<App />);
  });
  await flush();
}
async function flush(ms = 0) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}
const text = () => container.textContent ?? '';
const button = (label: RegExp) =>
  Array.from(container.querySelectorAll('button')).find((b) => label.test(b.textContent ?? '')) as HTMLButtonElement | undefined;
async function click(el: Element | undefined) {
  expect(el, 'element to click').toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await flush();
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('startup speed', () => {
  it('logged out: shows sign-in immediately and makes ZERO network calls', async () => {
    const h = setup({});
    await mount();
    expect(text()).toContain('Welcome back');
    expect(h.calls).toEqual([]);
  });

  it('signed in: paints the cached result before any network response arrives', async () => {
    // Both endpoints hang forever: whatever is on screen came from the cache alone.
    const never = () => new Promise<Response>(() => undefined);
    const h = setup({ store: signedIn(), routes: { '/api/auth/me': never, '/api/analysis/latest': never } });
    await mount();
    expect(text()).toContain('32.6%');
    expect(text()).toContain('AWS');
    expect(text()).toContain('Updating');
    // Both calls were started together, not one after the other.
    expect(h.calls).toEqual(['GET /api/auth/me', 'GET /api/analysis/latest']);
  });

  it('refreshes the cached view with fresh data and re-saves the snapshot', async () => {
    const fresh = { ...ANALYSIS, id: 8, overall_alignment_score: 50, skill_alignment: 50 };
    const h = setup({
      store: signedIn(),
      routes: { '/api/auth/me': () => respond(200, FULL_USER), '/api/analysis/latest': () => respond(200, fresh) },
    });
    await mount();
    await flush(20);
    expect(text()).toContain('50%');
    expect((h.store[SNAPSHOT_KEY] as { analysis: Analysis }).analysis.id).toBe(8);
    expect(JSON.stringify(h.store[SNAPSHOT_KEY])).not.toContain('access_token":"');
  });

  it('keeps showing cached results, with a notice, when the server is unreachable', async () => {
    setup({
      store: signedIn(),
      routes: {
        '/api/auth/me': () => Promise.reject(new TypeError('Failed to fetch')),
        '/api/analysis/latest': () => Promise.reject(new TypeError('Failed to fetch')),
      },
    });
    await mount();
    await flush(20);
    expect(text()).toContain('32.6%');
    expect(text()).toMatch(/Cannot reach the SkillSync server/);
  });
});

describe('session handling', () => {
  it('a 401 on startup clears the token and cache and returns to sign-in', async () => {
    const h = setup({
      store: signedIn(),
      routes: {
        '/api/auth/me': () => respond(401, { detail: 'Invalid or expired token' }),
        '/api/analysis/latest': () => respond(401, { detail: 'Invalid or expired token' }),
      },
    });
    await mount();
    await flush(20);
    expect(text()).toContain('Your session has expired');
    expect(h.store[ACCESS_TOKEN_STORAGE_KEY]).toBeUndefined();
    expect(h.store[SNAPSHOT_KEY]).toBeUndefined();
  });

  it('no analysis yet (404) shows the empty state, not an error', async () => {
    setup({
      store: signedIn(null),
      routes: {
        '/api/auth/me': () => respond(200, FULL_USER),
        '/api/analysis/latest': () => respond(404, { detail: 'No analysis found' }),
      },
    });
    await mount();
    await flush(20);
    expect(text()).toContain('No analysis yet');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});

describe('analyzing a page', () => {
  const okRoutes = (analysis: Analysis = ANALYSIS): Record<string, Route> => ({
    '/api/auth/me': () => respond(200, FULL_USER),
    '/api/analysis/latest': () => respond(404, { detail: 'No analysis found' }),
    '/api/profile': () => respond(200, { id: 1, user_id: 1, ...PROFILE }),
    '/api/analysis': () => respond(201, analysis),
  });

  it('LinkedIn profile: extracts, saves, analyzes, shows the exact backend score, and caches it', async () => {
    const h = setup({ store: signedIn(null), routes: okRoutes() });
    await mount();
    await click(button(/Analyze this profile/));
    await flush(50);

    expect(h.calls.slice(2)).toEqual(['PUT /api/profile', 'POST /api/analysis']);
    expect(text()).toContain('32.6%');
    expect(text()).toContain('Profile saved: 1 skill · 1 role · 0 education');
    expect((h.store[SNAPSHOT_KEY] as { analysis: Analysis }).analysis.id).toBe(7);
  });

  it('an unreadable profile is NOT saved and does not call the analysis endpoint', async () => {
    const empty: Profile = { name: 'Sign in', skills: [], experience: [], education: [], certifications: [], projects: [], source: 'linkedin' };
    const h = setup({
      store: signedIn(null),
      routes: okRoutes(),
      extraction: { success: true, profile: empty, report: { ...REPORT, counts: { ...REPORT.counts, skills: 0, experience: 0 } } },
    });
    await mount();
    await click(button(/Analyze this profile/));
    await flush(20);

    expect(h.calls.some((c) => c.startsWith('PUT') || c.startsWith('POST'))).toBe(false);
    expect(text()).toMatch(/couldn't read a headline or any job titles/);
    expect(button(/Copy diagnostic details/)).toBeTruthy();
  });

  it('a failed run (HTTP 201, status failed) shows the error and keeps the previous results', async () => {
    const failed = { ...ANALYSIS, id: 9, status: 'failed' as const, error_message: 'Could not generate market queries.' };
    setup({ store: signedIn(ANALYSIS), routes: { ...okRoutes(failed), '/api/analysis/latest': () => respond(200, ANALYSIS) } });
    await mount();
    await flush(20);
    await click(button(/Analyze this profile/));
    await flush(50);

    expect(text()).toContain('Could not generate market queries.');
    expect(text()).toContain('32.6%'); // the earlier good result is still shown
  });

  it('a 401 in the middle of an analysis returns to sign-in', async () => {
    const routes = { ...okRoutes(), '/api/profile': () => respond(401, { detail: 'Invalid or expired token' }) };
    const h = setup({ store: signedIn(null), routes });
    await mount();
    await click(button(/Analyze this profile/));
    await flush(30);
    expect(text()).toContain('Your session has expired');
    expect(h.store[ACCESS_TOKEN_STORAGE_KEY]).toBeUndefined();
  });

  it('a non-LinkedIn page cannot replace the profile without an explicit confirmation', async () => {
    const h = setup({ store: signedIn(null), tabUrl: 'https://github.com/someone', routes: okRoutes() });
    await mount();

    expect(button(/Open a LinkedIn profile to analyze/)?.disabled).toBe(true);
    await click(button(/Analyze this page anyway/));
    expect(text()).toContain('replacing the one you have now');
    expect(h.sendMessage).not.toHaveBeenCalled();

    await click(button(/^Cancel$/));
    expect(h.sendMessage).not.toHaveBeenCalled();
    expect(text()).not.toContain('replacing the one you have now');
  });

  it('browser-internal pages are unavailable and offer no way to analyze', async () => {
    setup({ store: signedIn(null), tabUrl: 'chrome://extensions', routes: okRoutes() });
    await mount();
    expect(text()).toContain("This page can't be read");
    expect(button(/Open a LinkedIn profile to analyze/)?.disabled).toBe(true);
    expect(button(/anyway/)).toBeUndefined();
  });
});

describe('zero-job and null-score results', () => {
  it('zero jobs shows a clear message, not a fake 0% score', async () => {
    const zero = { ...ANALYSIS, jobs_analyzed_count: 0, market_skills: {}, strengths: [], skill_gaps: [], overall_alignment_score: 0, skill_alignment: 0 };
    setup({ store: signedIn(zero), routes: { '/api/auth/me': () => respond(200, FULL_USER), '/api/analysis/latest': () => respond(200, zero) } });
    await mount();
    await flush(20);
    expect(text()).toContain('found no job listings');
    expect(text()).not.toContain('0%');
  });

  it('a null score renders as an em dash', async () => {
    const noScore = { ...ANALYSIS, overall_alignment_score: null };
    setup({ store: signedIn(noScore), routes: { '/api/auth/me': () => respond(200, FULL_USER), '/api/analysis/latest': () => respond(200, noScore) } });
    await mount();
    await flush(20);
    expect(text()).toContain('—');
    expect(text()).toContain('No score yet');
  });
});

describe('full skills list', () => {
  const SKILLS_URL = 'https://www.linkedin.com/in/jane/details/skills/';
  const skillsOnly = (names: string[]): ExtractionResponse => ({
    success: true,
    profile: { profile_url: SKILLS_URL, source: 'linkedin', skills: names.map((name) => ({ name })), experience: [], education: [], certifications: [], projects: [] },
    report: { ...REPORT, found: { name: false, headline: false, location: false, about: false }, counts: { ...REPORT.counts, skills: names.length, experience: 0 } },
  });
  const saved = (skills: string[], url = 'https://www.linkedin.com/in/jane/') => ({
    id: 1,
    user_id: 1,
    ...PROFILE,
    profile_url: url,
    skills: skills.map((name) => ({ name })),
  });
  const routes = (profile: (method: string) => Promise<Response> | Response): Record<string, Route> => ({
    '/api/auth/me': () => respond(200, FULL_USER),
    '/api/analysis/latest': () => respond(404, { detail: 'No analysis found' }),
    '/api/profile': profile,
    '/api/analysis': () => respond(201, ANALYSIS),
  });

  it('adds the skills to the saved profile instead of replacing it', async () => {
    const h = setup({
      store: signedIn(null),
      tabUrl: SKILLS_URL,
      extraction: skillsOnly(['Python', 'Docker']),
      routes: routes(() => respond(200, saved(['Python', 'AWS']))),
    });
    await mount();
    expect(button(/Add skills from this page/)).toBeTruthy();
    await click(button(/Add skills from this page/));
    await flush(50);

    expect(h.calls.slice(2)).toEqual(['GET /api/profile', 'PUT /api/profile', 'POST /api/analysis']);
    expect(text()).toContain('Skills added: 1 new, 3 in your profile now');
  });

  it('asks you to analyze the main profile first when nothing is saved yet', async () => {
    const h = setup({
      store: signedIn(null),
      tabUrl: SKILLS_URL,
      extraction: skillsOnly(['Python']),
      routes: routes(() => respond(404, { detail: 'Profile not found. Create one first.' })),
    });
    await mount();
    await click(button(/Add skills from this page/));
    await flush(30);

    expect(text()).toContain('Analyze your main LinkedIn profile page first');
    expect(h.calls.some((c) => c.startsWith('PUT') || c.startsWith('POST'))).toBe(false);
  });

  const partialPage = (declared: number): ExtractionResponse => ({
    success: true,
    profile: PROFILE,
    report: { ...REPORT, declaredCounts: { skills: declared }, warnings: [`Only 1 of ${declared} skills are visible on this profile page.`] },
  });

  it('re-analyzing the profile page keeps skills saved earlier from the full list', async () => {
    setup({
      store: signedIn(null),
      extraction: partialPage(5),
      routes: routes(() => respond(200, saved(['Python', 'AWS', 'Docker', 'Git', 'SQL']))),
    });
    await mount();
    await click(button(/Analyze this profile/));
    await flush(50);

    expect(text()).toContain('Profile saved: 5 skills');
    expect(text()).not.toContain('Open full skills list');
  });

  it('never merges another person\'s saved skills, and offers the full skills list instead', async () => {
    setup({
      store: signedIn(null),
      extraction: partialPage(5),
      routes: routes(() => respond(200, saved(['AWS', 'Docker', 'Git', 'SQL'], 'https://www.linkedin.com/in/someone-else/'))),
    });
    await mount();
    await click(button(/Analyze this profile/));
    await flush(50);

    expect(text()).toContain('Profile saved: 1 skill');
    expect(text()).toContain('Only 1 of your 5 LinkedIn skills could be read');
    expect(button(/Open full skills list/)).toBeTruthy();
  });

  it('can re-run the analysis on the saved profile without reading the page', async () => {
    const h = setup({
      store: signedIn(ANALYSIS),
      routes: { ...routes(() => respond(200, saved(['Python']))), '/api/analysis/latest': () => respond(200, ANALYSIS) },
    });
    await mount();
    await flush(20);
    await click(button(/Re-run with my saved profile/));
    await flush(50);

    expect(h.calls.slice(2)).toEqual(['POST /api/analysis']);
    expect(h.sendMessage).not.toHaveBeenCalled();
  });
});
