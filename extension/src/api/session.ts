import type { Analysis, User } from '../types/api';
import { ACCESS_TOKEN_STORAGE_KEY } from './config';

/**
 * Everything the popup persists in chrome.storage.local:
 *  - the bearer token (the only credential; HTTP-only cookies do not reach the extension)
 *  - a snapshot of the last user + analysis so the popup can paint instantly on
 *    open and revalidate in the background. The snapshot never contains the token.
 * Both are removed on logout and whenever the backend answers 401.
 */

const SNAPSHOT_KEY = 'skillsync_snapshot_v1';

export type SnapshotUser = Pick<User, 'id' | 'email' | 'full_name' | 'role'>;

export interface Snapshot {
  user: SnapshotUser;
  analysis: Analysis | null;
  savedAt: number;
}

export interface StoredSession {
  token: string | null;
  snapshot: Snapshot | null;
}

function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Snapshot>;
  return (
    typeof candidate.savedAt === 'number' &&
    !!candidate.user &&
    typeof candidate.user.id === 'number' &&
    typeof candidate.user.email === 'string'
  );
}

/** One storage round trip for both values (the popup's only work before first paint). */
export async function readStoredSession(): Promise<StoredSession> {
  try {
    const stored = await chrome.storage.local.get([ACCESS_TOKEN_STORAGE_KEY, SNAPSHOT_KEY]);
    const token = stored[ACCESS_TOKEN_STORAGE_KEY];
    const snapshot = stored[SNAPSHOT_KEY];
    return {
      token: typeof token === 'string' && token ? token : null,
      snapshot: isSnapshot(snapshot) ? snapshot : null,
    };
  } catch {
    return { token: null, snapshot: null };
  }
}

export async function getStoredAccessToken(): Promise<string | null> {
  return (await readStoredSession()).token;
}

export async function setStoredAccessToken(token: string): Promise<void> {
  try {
    await chrome.storage.local.set({ [ACCESS_TOKEN_STORAGE_KEY]: token });
  } catch {
    // Storage unavailable: the session simply will not persist.
  }
}

export async function writeSnapshot(user: SnapshotUser, analysis: Analysis | null): Promise<void> {
  const snapshot: Snapshot = {
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
    analysis,
    savedAt: Date.now(),
  };
  try {
    await chrome.storage.local.set({ [SNAPSHOT_KEY]: snapshot });
  } catch {
    // Cache is an optimisation only.
  }
}

/** Forget the token and the cached data (logout, 401). */
export async function clearSession(): Promise<void> {
  try {
    await chrome.storage.local.remove([ACCESS_TOKEN_STORAGE_KEY, SNAPSHOT_KEY]);
  } catch {
    // Nothing to clear.
  }
}
