import type {
  AdminStats,
  Analysis,
  AnalysisRequest,
  Profile,
  ProfileInput,
  User,
} from '../types';

// ─── Configuration ───
// NEXT_PUBLIC_API_URL is the backend ORIGIN (e.g. https://api.example.com).
// It is inlined into the browser bundle at build time, so it must never hold
// a secret. A trailing slash or "/api" suffix is tolerated.

const DEV_DEFAULT_ORIGIN = 'http://localhost:8000';

function resolveApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    return `${configured.replace(/\/+$/, '').replace(/\/api$/, '')}/api`;
  }
  if (process.env.NODE_ENV !== 'production') {
    return `${DEV_DEFAULT_ORIGIN}/api`;
  }
  throw new ApiError(
    'config',
    0,
    'The dashboard is not configured: NEXT_PUBLIC_API_URL is missing from this build.',
  );
}

// ─── Errors ───

export type ApiErrorKind =
  | 'config'
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'rate_limited'
  | 'server'
  | 'unknown';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  /** Per-field messages for 422 responses, keyed by field path (e.g. "profile_url"). */
  readonly fieldErrors: Record<string, string>;
  readonly retryAfterSeconds?: number;

  constructor(
    kind: ApiErrorKind,
    status: number,
    message: string,
    options: { fieldErrors?: Record<string, string>; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.fieldErrors = options.fieldErrors ?? {};
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 422) return 'validation';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server';
  return 'unknown';
}

interface ValidationIssue {
  loc?: unknown[];
  msg?: string;
}

function parseValidationIssues(detail: unknown): { message: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  const messages: string[] = [];
  if (Array.isArray(detail)) {
    for (const raw of detail as ValidationIssue[]) {
      const msg = typeof raw?.msg === 'string' ? raw.msg.replace(/^Value error, /, '') : 'Invalid value';
      const path = (raw?.loc ?? []).filter((p) => p !== 'body').join('.');
      if (path && !(path in fields)) fields[path] = msg;
      messages.push(path ? `${path}: ${msg}` : msg);
    }
  }
  return { message: messages.join('; ') || 'Some of the submitted data is invalid.', fields };
}

async function toApiError(response: Response): Promise<ApiError> {
  const kind = kindForStatus(response.status);
  let detail: unknown;
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'detail' in body) {
      detail = (body as { detail: unknown }).detail;
    }
  } catch {
    // Non-JSON body (e.g. proxy error page) – fall through to defaults.
  }

  if (kind === 'validation') {
    const { message, fields } = parseValidationIssues(detail);
    return new ApiError(kind, response.status, message, { fieldErrors: fields });
  }

  let retryAfterSeconds: number | undefined;
  if (kind === 'rate_limited') {
    const header = Number(response.headers.get('Retry-After'));
    if (Number.isFinite(header) && header > 0) retryAfterSeconds = header;
  }

  const message =
    typeof detail === 'string' && detail.trim()
      ? detail
      : response.statusText || `Request failed (${response.status})`;
  return new ApiError(kind, response.status, message, { retryAfterSeconds });
}

// ─── Transport ───

let refreshInFlight: Promise<boolean> | null = null;

/** Try to rotate the session once; concurrent callers share a single request. */
function refreshSession(base: string): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${base}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function fetchClient<T>(endpoint: string, options: RequestInit = {}, retried = false): Promise<T> {
  const base = resolveApiBase();

  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    // credentials: include sends the HTTP-only JWT cookies to the backend.
    response = await fetch(`${base}${endpoint}`, { ...options, headers, credentials: 'include' });
  } catch {
    throw new ApiError(
      'network',
      0,
      'Cannot reach the SkillSync server. Check your connection or try again shortly.',
    );
  }

  // Expired access token: refresh once, then retry. Auth endpoints are excluded
  // so a wrong password is never retried.
  if (response.status === 401 && !retried && !endpoint.startsWith('/auth/')) {
    if (await refreshSession(base)) {
      return fetchClient<T>(endpoint, options, true);
    }
  }

  if (!response.ok) throw await toApiError(response);

  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError('server', response.status, 'The server returned an unreadable response.');
  }
}

// ─── Auth ───

export function login(email: string, password: string): Promise<User> {
  return fetchClient<User>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function register(email: string, password: string, fullName: string): Promise<User> {
  return fetchClient<User>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
}

export function logout(): Promise<void> {
  return fetchClient<void>('/auth/logout', { method: 'POST' });
}

export function getCurrentUser(): Promise<User> {
  return fetchClient<User>('/auth/me', { method: 'GET' });
}

// ─── Profile ───

export function getProfile(): Promise<Profile> {
  return fetchClient<Profile>('/profile', { method: 'GET' });
}

export function saveProfile(profile: ProfileInput): Promise<Profile> {
  return fetchClient<Profile>('/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}

// ─── Analysis ───

export function getLatestAnalysis(): Promise<Analysis> {
  return fetchClient<Analysis>('/analysis/latest', { method: 'GET' });
}

export function getAnalysisHistory(): Promise<Analysis[]> {
  return fetchClient<Analysis[]>('/analysis', { method: 'GET' });
}

export function createAnalysis(request: AnalysisRequest = { target_roles: [], target_locations: [] }): Promise<Analysis> {
  return fetchClient<Analysis>('/analysis', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// ─── Admin ───

export function getAdminStats(): Promise<AdminStats> {
  return fetchClient<AdminStats>('/admin/stats', { method: 'GET' });
}
