import { describe, expect, it } from 'vitest';
import { formatRelative, formatScore, scoreTone } from './format';
import { classifyPage, contentScriptFor, sameLinkedInProfile, skillsListUrl } from './pageInfo';

describe('classifyPage', () => {
  it.each([
    ['https://www.linkedin.com/in/jane-doe/', 'linkedin-profile'],
    ['https://linkedin.com/in/jane', 'linkedin-profile'],
    ['https://in.linkedin.com/in/jane', 'linkedin-profile'],
    ['https://www.linkedin.com/in/jane/details/skills/', 'linkedin-skills'],
    ['https://www.linkedin.com/in/jane/details/skills', 'linkedin-skills'],
    ['https://www.linkedin.com/in/jane/overlay/contact-info/', 'linkedin-profile'],
    ['https://www.linkedin.com/in/jane/details/experience/', 'linkedin-other'],
    ['https://www.linkedin.com/in/jane/recent-activity/all/', 'linkedin-other'],
    ['https://www.linkedin.com/feed/', 'linkedin-other'],
    ['https://www.linkedin.com/company/acme/', 'linkedin-other'],
    ['https://github.com/someone', 'other'],
    ['https://evil.example/linkedin.com/in/x', 'other'],
    ['https://notlinkedin.com/in/x', 'other'],
    ['chrome://extensions', 'restricted'],
    ['chrome-extension://abc/popup.html', 'restricted'],
    ['about:blank', 'restricted'],
    ['https://chromewebstore.google.com/detail/x', 'restricted'],
    [undefined, 'restricted'],
    ['not a url', 'restricted'],
  ])('%s -> %s', (url, kind) => {
    expect(classifyPage(url as string | undefined).kind).toBe(kind);
  });

  it('routes content scripts the way the manifest does', () => {
    expect(contentScriptFor('https://www.linkedin.com/in/jane/')).toBe('content_linkedin.js');
    expect(contentScriptFor('https://www.linkedin.com/in/jane/details/skills/')).toBe('content_linkedin.js');
    expect(contentScriptFor('https://github.com/jane')).toBe('content_generic.js');
    expect(contentScriptFor(undefined)).toBe('content_generic.js');
  });
});

describe('formatRelative', () => {
  const now = Date.parse('2026-10-08T12:00:00Z');
  it.each([
    ['2026-10-08T11:59:40Z', 'just now'],
    ['2026-10-08T11:55:00Z', '5 min ago'],
    ['2026-10-08T09:00:00Z', '3 h ago'],
    ['2026-10-06T12:00:00Z', '2 days ago'],
    ['2026-10-07T12:00:00Z', '1 day ago'],
  ])('%s -> %s', (iso, expected) => {
    expect(formatRelative(iso, now)).toBe(expected);
  });
  it('is empty for missing or invalid dates', () => {
    expect(formatRelative(null, now)).toBe('');
    expect(formatRelative('garbage', now)).toBe('');
  });
});

describe('scoreTone', () => {
  it('uses the dashboard thresholds', () => {
    expect(scoreTone(80)).toBe('good');
    expect(scoreTone(79.9)).toBe('fair');
    expect(scoreTone(60)).toBe('fair');
    expect(scoreTone(32.6)).toBe('low');
  });
});

describe('formatScore', () => {
  it('keeps the backend precision', () => {
    expect(formatScore(32.6)).toBe('32.6%');
    expect(formatScore(80)).toBe('80%');
    expect(formatScore(0)).toBe('0%');
    expect(formatScore(66.666)).toBe('66.7%');
  });
});

describe('sameLinkedInProfile / skillsListUrl', () => {
  it('compares people by their /in/<name> path, ignoring host, case and sub-page', () => {
    expect(sameLinkedInProfile('https://www.linkedin.com/in/Jane/', 'https://in.linkedin.com/in/jane/details/skills/')).toBe(true);
    expect(sameLinkedInProfile('https://www.linkedin.com/in/jane/', 'https://www.linkedin.com/in/john/')).toBe(false);
    expect(sameLinkedInProfile(null, 'https://www.linkedin.com/in/john/')).toBe(false);
    expect(sameLinkedInProfile('https://evil.example/in/jane/', 'https://evil.example/in/jane/')).toBe(false);
  });

  it('builds the full skills list URL for a profile, and only for a profile', () => {
    expect(skillsListUrl('https://www.linkedin.com/in/jane/')).toBe('https://www.linkedin.com/in/jane/details/skills/');
    expect(skillsListUrl('https://in.linkedin.com/in/jane/overlay/contact-info/')).toBe('https://in.linkedin.com/in/jane/details/skills/');
    expect(skillsListUrl('https://github.com/jane')).toBeNull();
    expect(skillsListUrl(undefined)).toBeNull();
  });
});
