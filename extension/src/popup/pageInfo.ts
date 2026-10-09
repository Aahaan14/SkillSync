/**
 * What kind of page is the active tab? Drives what the popup offers: a one-click
 * analysis on a LinkedIn profile, a guarded "analyze anyway" elsewhere, and a
 * clear "can't read this page" on browser-internal pages.
 */

export type PageKind = 'linkedin-profile' | 'linkedin-other' | 'other' | 'restricted';

export interface PageInfo {
  kind: PageKind;
  /** Hostname for display, e.g. "www.linkedin.com". */
  host: string;
}

const RESTRICTED_SCHEMES = /^(chrome|chrome-extension|chrome-untrusted|edge|about|view-source|devtools|moz-extension|brave):/i;

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
  if (isLinkedIn) {
    return { kind: parsed.pathname.startsWith('/in/') ? 'linkedin-profile' : 'linkedin-other', host };
  }
  return { kind: 'other', host };
}

/** Which content script answers EXTRACT_PROFILE for this URL (mirrors manifest content_scripts). */
export function contentScriptFor(url: string | undefined): string {
  return classifyPage(url).kind === 'linkedin-profile' ? 'content_linkedin.js' : 'content_generic.js';
}
