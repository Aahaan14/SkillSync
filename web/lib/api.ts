import { User, Profile, Analysis } from '../types';

const API_BASE_URL = 'http://localhost:8000/api';

async function fetchClient(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  
  // Important: include credentials so HTTP-only JWT cookies are sent to the backend
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
    throw new Error(errorDetail);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

// Auth
export async function login(email: string, password: string): Promise<User> {
  return fetchClient('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function register(email: string, password: string, fullName: string): Promise<User> {
  return fetchClient('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
}

export async function logout(): Promise<void> {
  return fetchClient('/auth/logout', { method: 'POST' });
}

export async function getCurrentUser(): Promise<User> {
  return fetchClient('/auth/me', { method: 'GET' });
}

// Profile
export async function getProfile(): Promise<Profile> {
  return fetchClient('/profile', { method: 'GET' });
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  return fetchClient('/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}

// Analysis
export async function getLatestAnalysis(): Promise<Analysis> {
  return fetchClient('/analysis/latest', { method: 'GET' });
}

export async function getAnalysisHistory(): Promise<Analysis[]> {
  return fetchClient('/analysis', { method: 'GET' });
}

// Admin
export async function getAdminStats() {
  return fetchClient('/admin/stats', { method: 'GET' });
}
