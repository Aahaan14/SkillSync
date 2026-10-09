/**
 * What kind of page is the active tab? Drives what the popup offers: a one-click
 * analysis on a LinkedIn profile, "add skills" on LinkedIn's full skills list, a
 * guarded "analyze anyway" elsewhere, and a clear "can't read this page" on
 * browser-internal pages.
 *
 * Nothing here may be imported by a content script (and no content-script file may
 * be imported here): a module shared by the popup and a content script makes the
 * bundler emit a shared chunk, and content scripts cannot use `import`.
 */

export type PageKind = 'linkedin-profile' | 'linkedin-skills' | 'linkedin-other' | 'other' | 'restricted';

export interface PageInfo {
  kind: PageKind;
  /** Hostname for display, e.g. "www.linkedin.com". */
  host: string;
}

const RESTRICTED_SCHEMES = /^(chrome|chrome-extension|chrome-untrusted|edge|about|view-source|devtools|moz-extension|brave):/i;

/**
 * linkedin.com/in/<name>/                  -> the profile itself
 * linkedin.com/in/<name>/overlay/...       -> a popup over the profile (e.g. contact info)
 * linkedin.com/in/<name>/details/skills/   -> the full skills list
 * anything else under /in/<name>/ (details/experience, recent-activity, ...) is NOT the
 * profile page and has none of the sections the reader looks for.
 */
function linkedInKind(pathname: string): PageKind {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'in' || !parts[1]) return 'linkedin-other';
  const rest = parts.slice(2);
  if (rest.length === 0 || rest[0] === 'overlay') return 'linkedin-profile';
  if (rest.length === 2 && rest[0] === 'details' && rest[1] === 'skills') return 'linkedin-skills';
  return 'linkedin-other';
}

export function classifyPage(url: string | undefined): PageInfo {
  if (!url || RESTRICTED_SCHEMES.test(url)) return { kind: 'restricted', host: '' };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: 'restricted', host: '' };
  }

  const host = parsed.hostname;
  if (host === 'chromewebstore.google.com' || (host === 'chrome.google.com' && parsed.pathname.startsWith('/webstore'))) {
    return { kind: 'restricted', host };
  }

  const isLinkedIn = host === 'linkedin.com' || host.endsWith('.linkedin.com');
  if (isLinkedIn) return { kind: linkedInKind(parsed.pathname), host };
  return { kind: 'other', host };
}

/** Which content script answers EXTRACT_PROFILE for this URL (mirrors manifest content_scripts). */
export function contentScriptFor(url: string | undefined): string {
  const kind = classifyPage(url).kind;
  return kind === 'linkedin-profile' || kind === 'linkedin-skills' ? 'content_linkedin.js' : 'content_generic.js';
}

/** "/in/jane-doe" (lower-cased) for any LinkedIn profile URL, else null. */
function profilePath(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!/(^|\.)linkedin\.com$/i.test(parsed.hostname)) return null;
    const [first, name] = parsed.pathname.split('/').filter(Boolean);
    return first === 'in' && name ? `/in/${name.toLowerCase()}` : null;
  } catch {
    return null;
  }
}

/** True when both URLs are the same person's LinkedIn profile (any sub-page, any host variant). */
export function sameLinkedInProfile(a: string | null | undefined, b: string | null | undefined): boolean {
  const pa = profilePath(a);
  return pa !== null && pa === profilePath(b);
}

/** The full skills list for a profile URL, or null when the URL is not a LinkedIn profile. */
export function skillsListUrl(url: string | null | undefined): string | null {
  const path = profilePath(url);
  if (!path || !url) return null;
  const { origin, pathname } = new URL(url);
  const name = pathname.split('/').filter(Boolean)[1];
  return `${origin}/in/${name}/details/skills/`;
}
