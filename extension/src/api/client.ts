import type { Profile } from '../types';
import type { Analysis, AnalysisRequest, ApiProfile, User } from '../types/api';
import { API_BASE_URL } from './config';
import { ApiError, toApiError } from './errors';
import { mergeSkills } from './mergeSkills';
import { toProfilePayload } from './profilePayload';
import { clearSession, getStoredAccessToken, setStoredAccessToken } from './session';

export { ApiError, isApiError, errorMessage } from './errors';
export type { ApiErrorKind } from './errors';

// ─── Transport ───

/** Endpoints where a 401 means "bad credentials", not "your session expired". */
const CREDENTIAL_ENDPOINTS = new Set(['/auth/login', '/auth/register', '/auth/logout']);

/** Quick calls fail fast so the popup never hangs; the analysis run gets far longer. */
const DEFAULT_TIMEOUT_MS = 10_000;
const ANALYSIS_TIMEOUT_MS = 180_000;

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

async function fetchClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options;
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');

  const token = await getStoredAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...init,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      'network',
      0,
      controller.signal.aborted
        ? 'The SkillSync server took too long to respond. Please try again.'
        : 'Cannot reach the SkillSync server. Check that it is running and try again.',
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const error = await toApiError(response);
    // The backend rejected our token: drop it so the UI returns to the login
    // screen instead of failing every later request with the same 401.
    if (error.kind === 'unauthorized' && !CREDENTIAL_ENDPOINTS.has(endpoint)) {
      await clearSession();
    }
    throw error;
  }

  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError('server', response.status, 'The server returned an unreadable response.');
  }
}

// ─── Auth ───

async function startSession(user: User): Promise<User> {
  if (!user.access_token) {
    // Never pretend authentication succeeded without a token to authenticate with.
    throw new ApiError('server', 200, 'The server did not return a session token. Please try again.');
  }
  await setStoredAccessToken(user.access_token);
  return user;
}

export async function login(email: string, password: string): Promise<User> {
  const user = await fetchClient<User>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return startSession(user);
}

export async function register(email: string, password: string, fullName: string): Promise<User> {
  const user = await fetchClient<User>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name: fullName.trim() || undefined }),
  });
  return startSession(user);
}

export async function logout(): Promise<void> {
  try {
    await fetchClient<unknown>('/auth/logout', { method: 'POST' });
  } finally {
    await clearSession();
  }
}

/** Authoritative current user. Throws ApiError('unauthorized') when not signed in. */
export function getCurrentUser(): Promise<User> {
  return fetchClient<User>('/auth/me', { method: 'GET' });
}

// ─── Profile ───

export function getProfile(): Promise<ApiProfile> {
  return fetchClient<ApiProfile>('/profile', { method: 'GET' });
}

/** Accepts raw extractor output; it is clamped to the backend's limits first. */
export function saveProfile(draft: Profile): Promise<ApiProfile> {
  return fetchClient<ApiProfile>('/profile', {
    method: 'PUT',
    body: JSON.stringify(toProfilePayload(draft)),
  });
}

/**
 * The "Show all skills" page only has skills, so instead of replacing the saved
 * profile, add them to it. Throws ApiError('not_found') if nothing is saved yet.
 */
export async function addSkillsToProfile(found: Array<{ name: string; endorsements?: number | null }>): Promise<{ added: number; total: number }> {
  const saved = await getProfile();
  const skills = mergeSkills(saved.skills ?? [], found);
  await fetchClient<ApiProfile>('/profile', {
    method: 'PUT',
    body: JSON.stringify({
      name: saved.name,
      headline: saved.headline,
      about: saved.about,
      location: saved.location,
      profile_url: saved.profile_url,
      source: saved.source,
      skills,
      experience: saved.experience,
      education: saved.education,
      certifications: saved.certifications,
      projects: saved.projects,
    }),
  });
  return { added: skills.length - (saved.skills ?? []).length, total: skills.length };
}

// ─── Analysis ───

/**
 * Note: a run that fails server-side still resolves (HTTP 201) with
 * `status: "failed"` and an `error_message`. Callers must check `status`.
 */
export function triggerAnalysis(
  targetRoles: string[] = [],
  targetLocations: string[] = [],
): Promise<Analysis> {
  const body: AnalysisRequest = { target_roles: targetRoles, target_locations: targetLocations };
  return fetchClient<Analysis>('/analysis', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: ANALYSIS_TIMEOUT_MS,
  });
}

/** Rejects with ApiError('not_found') when the user has never run an analysis. */
export function getLatestAnalysis(): Promise<Analysis> {
  return fetchClient<Analysis>('/analysis/latest', { method: 'GET' });
}
