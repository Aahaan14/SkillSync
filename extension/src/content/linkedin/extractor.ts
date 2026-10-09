import type { ExtractionResponse } from '../../types';
import { extractWhenReady } from './ready';

// The parser lives in parse.ts (pure, unit-tested) and the bounded wait for
// LinkedIn's lazily rendered content in ready.ts. This file only wires them to
// the message the popup sends.
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.action !== 'EXTRACT_PROFILE') return undefined;

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
