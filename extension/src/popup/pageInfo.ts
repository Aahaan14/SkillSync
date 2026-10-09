/**
 * What kind of page is the active tab? Drives what the popup offers: a one-click
 * analysis on a LinkedIn profile, a guarded "analyze anyway" elsewhere, and a
 * clear "can't read this page" on browser-internal pages.
 */

export type PageKind = 'linkedin-profile' | 'linkedin-skills' | 'linkedin-other' | 'other' | 'restricted';

export interface PageInfo {
  kind: PageKind;
  /** Hostname for display, e.g. "www.linkedin.com". */
  host: string;
}

/**
 * /in/<name>/details/skills/ ("Show all skills"). Deliberately NOT imported from
 * content/linkedin/shared.ts: a module shared by the popup and a content script makes
 * the bundler emit a shared chunk, and content scripts cannot use `import`.
 * Keep in sync with isSkillsDetailsPath() in content/linkedin/shared.ts.
 */
const isSkillsDetailsPath = (pathname: string): boolean => /^\/in\/[^/]+\/details\/skills\/?$/i.test(pathname);

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
    if (isSkillsDetailsPath(parsed.pathname)) return { kind: 'linkedin-skills', host };
    return { kind: parsed.pathname.startsWith('/in/') ? 'linkedin-profile' : 'linkedin-other', host };
  }
  return { kind: 'other', host };
}

/** Which content script answers EXTRACT_PROFILE for this URL (mirrors manifest content_scripts). */
export function contentScriptFor(url: string | undefined): string {
  const kind = classifyPage(url).kind;
  return kind === 'linkedin-profile' || kind === 'linkedin-skills' ? 'content_linkedin.js' : 'content_generic.js';
}
