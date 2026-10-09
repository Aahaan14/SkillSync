import type { ExtractionResponse } from '../../types';
import { extractWhenReady } from './ready';
import { isSkillsDetailsPath } from './shared';
import { parseSkillsPage, readSkillsWhenReady, skillsPageReport } from './skillsPage';

// The parser lives in parse.ts (pure, unit-tested) and the bounded wait for
// LinkedIn's lazily rendered content in ready.ts. This file only wires them to
// the message the popup sends. The full skills list page (/details/skills/) has
// its own, much simpler reader in skillsPage.ts.
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  // Cheap, instant count so the popup can show "61 skills detected" before the user commits.
  if (request?.action === 'COUNT_SKILLS') {
    sendResponse({ count: isSkillsDetailsPath(window.location.pathname) ? parseSkillsPage(document).length : 0 });
    return undefined;
  }
  if (request?.action !== 'EXTRACT_PROFILE') return undefined;

  if (isSkillsDetailsPath(window.location.pathname)) {
    readSkillsWhenReady(document)
      .then((skills) => {
        const response: ExtractionResponse = {
          success: true,
          // Only skills are filled in; the popup merges them into the saved profile.
          profile: {
            profile_url: window.location.href,
            source: 'linkedin',
            skills,
            experience: [],
            education: [],
            certifications: [],
            projects: [],
          },
          report: skillsPageReport(skills.length),
        };
        sendResponse(response);
      })
      .catch((error: unknown) => {
        const response: ExtractionResponse = {
          success: false,
          error: error instanceof Error ? error.message : 'Could not read the skills list.',
        };
        sendResponse(response);
      });
    return true;
  }

  extractWhenReady(document, window.location.href)
    .then(({ profile, report }) => {
      const response: ExtractionResponse = { success: true, profile, report };
      sendResponse(response);
    })
    .catch((error: unknown) => {
      const response: ExtractionResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Could not read this LinkedIn page.',
      };
      sendResponse(response);
    });
  return true; // the answer is sent asynchronously, after the bounded wait
});
