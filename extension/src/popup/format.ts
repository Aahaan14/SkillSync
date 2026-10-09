/** "just now", "5 min ago", "3 h ago", "2 days ago", or a short date for older. */
export function formatRelative(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Score band used for colour; thresholds match the dashboard's 80 / 60 convention. */
export function scoreTone(score: number): 'good' | 'fair' | 'low' {
  if (score >= 80) return 'good';
  if (score >= 60) return 'fair';
  return 'low';
}

/** Same precision as the dashboard: 32.6 stays "32.6%", 80 becomes "80%". Never rounds the backend's score. */
export function formatScore(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}
