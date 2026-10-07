import type { Profile } from '../types';
import type { Analysis, AnalysisRequest, ApiProfile, User } from '../types/api';
import { ACCESS_TOKEN_STORAGE_KEY, API_BASE_URL } from './config';
import { ApiError, toApiError } from './errors';
import { toProfilePayload } from './profilePayload';

export { ApiError, isApiError, errorMessage } from './errors';
export type { ApiErrorKind } from './errors';

// ─── Token storage ───
// HTTP-only cookies are not sent from chrome-extension:// pages to the backend,
// so the extension authenticates with `Authorization: Bearer <access_token>`.
// The backend is the only party that ever issues or validates this token.

async function getStoredAccessToken(): Promise<string | null> {
  try {
    const stored = await chrome.storage.local.get(ACCESS_TOKEN_STORAGE_KEY);
    const token = stored[ACCESS_TOKEN_STORAGE_KEY];
    return typeof token === 'string' && token ? token : null;
  } catch {
    return null;
  }
}

async function setStoredAccessToken(token: string | null): Promise<void> {
  try {
    if (token) {
      await chrome.storage.local.set({ [ACCESS_TOKEN_STORAGE_KEY]: token });
    } else {
      await chrome.storage.local.remove(ACCESS_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable: nothing to persist or clear.
  }
}

// ─── Transport ───

/** Endpoints where a 401 means "bad credentials", not "your session expired". */
const CREDENTIAL_ENDPOINTS = new Set(['/auth/login', '/auth/register', '/auth/logout']);

async function fetchClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');

  const token = await getStoredAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers, credentials: 'include' });
  } catch {
    throw new ApiError(
      'network',
      0,
      'Cannot reach the SkillSync server. Check that it is running and try again.',
    );
  }

  if (!response.ok) {
    const error = await toApiError(response);
    // The backend rejected our token: drop it so the UI returns to the login
    // screen instead of failing every later request with the same 401.
    if (error.kind === 'unauthorized' && !CREDENTIAL_ENDPOINTS.has(endpoint)) {
      await setStoredAccessToken(null);
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
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
  return startSession(user);
}

export async function logout(): Promise<void> {
  try {
    await fetchClient<unknown>('/auth/logout', { method: 'POST' });
  } finally {
    await setStoredAccessToken(null);
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
  return fetchClient<Analysis>('/analysis', { method: 'POST', body: JSON.stringify(body) });
}

/** Rejects with ApiError('not_found') when the user has never run an analysis. */
export function getLatestAnalysis(): Promise<Analysis> {
  return fetchClient<Analysis>('/analysis/latest', { method: 'GET' });
}
