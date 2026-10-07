/**
 * Error contract of the SkillSync backend:
 *   - non-422 errors: { "detail": "<message>" }
 *   - 422 validation: { "detail": [{ "loc": [...], "msg": "...", "type": "..." }] }
 */

export type ApiErrorKind =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'rate_limited'
  | 'server'
  | 'unknown';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  /** Per-field messages for 422 responses, keyed by field path (e.g. "projects.0.url"). */
  readonly fieldErrors: Record<string, string>;

  constructor(
    kind: ApiErrorKind,
    status: number,
    message: string,
    fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 422) return 'validation';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server';
  return 'unknown';
}

interface ValidationIssue {
  loc?: unknown[];
  msg?: string;
}

export function parseValidationDetail(detail: unknown): {
  message: string;
  fields: Record<string, string>;
} {
  const fields: Record<string, string> = {};
  const messages: string[] = [];
  if (Array.isArray(detail)) {
    for (const raw of detail as ValidationIssue[]) {
      const msg =
        typeof raw?.msg === 'string' ? raw.msg.replace(/^Value error, /, '') : 'Invalid value';
      const path = (raw?.loc ?? []).filter((part) => part !== 'body').join('.');
      if (path && !(path in fields)) fields[path] = msg;
      messages.push(path ? `${path}: ${msg}` : msg);
    }
  }
  return { message: messages.join('; ') || 'Some of the submitted data is invalid.', fields };
}

const FRIENDLY: Partial<Record<ApiErrorKind, string>> = {
  rate_limited: 'Too many requests. Please wait a moment and try again.',
  server: 'The SkillSync server had a problem. Please try again shortly.',
};

/** Convert a non-OK fetch Response into an ApiError. */
export async function toApiError(response: Response): Promise<ApiError> {
  const kind = kindForStatus(response.status);
  let detail: unknown;
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'detail' in body) {
      detail = (body as { detail: unknown }).detail;
    }
  } catch {
    // Non-JSON body (e.g. a proxy error page): fall through to the defaults.
  }

  if (kind === 'validation') {
    const { message, fields } = parseValidationDetail(detail);
    return new ApiError(kind, response.status, message, fields);
  }

  const message =
    typeof detail === 'string' && detail.trim()
      ? detail
      : (FRIENDLY[kind] ?? (response.statusText || `Request failed (${response.status})`));
  return new ApiError(kind, response.status, message);
}
