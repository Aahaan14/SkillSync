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

/**
 * How many skills are currently rendered on the LinkedIn skills-list tab, or null when it
 * cannot be told (no script listening and none could be injected). Read-only and instant.
 */
export async function countSkillsOnTab(tab: { id?: number; url?: string }): Promise<number | null> {
  const tabId = tab.id;
  if (tabId === undefined) return null;
  const ask = (): Promise<{ count?: number } | undefined> => chrome.tabs.sendMessage(tabId, { action: 'COUNT_SKILLS' });
  try {
    try {
      return (await ask())?.count ?? null;
    } catch {
      await chrome.scripting.executeScript({ target: { tabId }, files: [contentScriptFor(tab.url)] });
      return (await ask())?.count ?? null;
    }
  } catch {
    return null;
  }
}
