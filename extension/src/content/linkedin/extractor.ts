import type { ExtractionResponse } from '../../types';
import { parseLinkedInProfile } from './parse';

// The parser lives in parse.ts (pure, unit-tested). This file only wires it to
// the message the popup sends.
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.action !== 'EXTRACT_PROFILE') return undefined;

  try {
    const { profile, report } = parseLinkedInProfile(document, window.location.href);
    const response: ExtractionResponse = { success: true, profile, report };
    sendResponse(response);
  } catch (error) {
    const response: ExtractionResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Could not read this LinkedIn page.',
    };
    sendResponse(response);
  }
  return false; // synchronous response
});
