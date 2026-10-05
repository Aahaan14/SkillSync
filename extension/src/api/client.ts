import { Profile } from '../types';

const API_BASE_URL = 'http://localhost:8000/api';
const ACCESS_TOKEN_KEY = 'skillsync_access_token';

async function getStoredAccessToken(): Promise<string | null> {
  try {
    const stored = await chrome.storage.local.get(ACCESS_TOKEN_KEY);
    const token = stored[ACCESS_TOKEN_KEY];
    return typeof token === 'string' ? token : null;
  } catch {
    return null;
  }
}

async function setStoredAccessToken(token: string | null): Promise<void> {
  if (token) {
    await chrome.storage.local.set({ [ACCESS_TOKEN_KEY]: token });
  } else {
    await chrome.storage.local.remove(ACCESS_TOKEN_KEY);
  }
}

/**
 * Fetch wrapper. Chrome extension pages cannot rely on HTTP-only cookies
 * for localhost, so we persist a Bearer access token in chrome.storage.
 */
async function fetchClient(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  const token = await getStoredAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let errorDetail = 'API request failed';
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorDetail;
    } catch {
      errorDetail = response.statusText;
    }
    throw new Error(typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail));
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

export async function login(email: string, password: string) {
  const data = await fetchClient('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.access_token) {
    await setStoredAccessToken(data.access_token);
  }
  return data;
}

export async function register(email: string, password: string, fullName: string) {
  const data = await fetchClient('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
  if (data.access_token) {
    await setStoredAccessToken(data.access_token);
  }
  return data;
}

export async function logout() {
  try {
    await fetchClient('/auth/logout', { method: 'POST' });
  } finally {
    await setStoredAccessToken(null);
  }
}

export async function getCurrentUser() {
  return fetchClient('/auth/me', { method: 'GET' });
}

export async function getProfile() {
  return fetchClient('/profile', { method: 'GET' });
}

export async function saveProfile(profile: Profile) {
  return fetchClient('/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}

export async function triggerAnalysis(targetRoles: string[] = [], targetLocations: string[] = []) {
  return fetchClient('/analysis', {
    method: 'POST',
    body: JSON.stringify({ target_roles: targetRoles, target_locations: targetLocations }),
  });
}

export async function getLatestAnalysis() {
  return fetchClient('/analysis/latest', {
    method: 'GET',
  });
}
