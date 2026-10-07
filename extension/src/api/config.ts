/**
 * API configuration. Everything comes from Vite env vars (see .env.example) so
 * no backend URL is hardcoded in feature code. These values are bundled into
 * the extension and visible to anyone who installs it: never put secrets here.
 *
 * VITE_API_URL  Backend ORIGIN, e.g. https://api.example.com (no trailing "/api").
 * VITE_WEB_URL  Web dashboard origin, used for the "View Full Web Dashboard" link.
 *
 * If you point VITE_API_URL at a non-localhost origin you must also add it to
 * host_permissions in public/manifest.json, or Chrome will block the requests.
 */

const DEV_API_ORIGIN = 'http://localhost:8000';
const DEV_WEB_ORIGIN = 'http://localhost:3000';

function origin(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return (trimmed || fallback).replace(/\/+$/, '');
}

export const API_ORIGIN = origin(import.meta.env.VITE_API_URL, DEV_API_ORIGIN).replace(/\/api$/, '');
export const API_BASE_URL = `${API_ORIGIN}/api`;
export const WEB_APP_URL = origin(import.meta.env.VITE_WEB_URL, DEV_WEB_ORIGIN);
export const ACCESS_TOKEN_STORAGE_KEY = 'skillsync_access_token';
