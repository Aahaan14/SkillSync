import type { ExtractionResponse } from '../types';
import { contentScriptFor } from './pageInfo';

/**
 * Ask the active tab's content script for the profile.
 *
 * If no script is listening (the tab predates the extension, or LinkedIn - a
 * single-page app - navigated without a page load, which Chrome does not treat
 * as a new document) inject it on demand and ask again.
 */
export async function extractFromTab(tab: { id?: number; url?: string }): Promise<ExtractionResponse> {
  const tabId = tab.id;
  if (tabId === undefined) {
    return { success: false, error: 'No active tab found. Open a profile page and try again.' };
  }

  const ask = (): Promise<ExtractionResponse | undefined> =>
    chrome.tabs.sendMessage(tabId, { action: 'EXTRACT_PROFILE' });

  let response: ExtractionResponse | undefined;
  try {
    response = await ask();
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: [contentScriptFor(tab.url)] });
      response = await ask();
    } catch {
      return {
        success: false,
        error: 'Could not read this page. Open a profile page (for LinkedIn: linkedin.com/in/...), refresh it, and try again.',
      };
    }
  }

  if (!response) return { success: false, error: 'The page did not respond. Refresh it and try again.' };
  return response;
}
