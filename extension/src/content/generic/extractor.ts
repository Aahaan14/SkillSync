import { Profile, ProfileExtractor } from '../../types';

class GenericExtractor implements ProfileExtractor {
  async extractProfile(): Promise<Profile> {
    // For unsupported websites, attempt to extract useful visible text and metadata.
    // We don't claim full support, but we provide text for the AI/backend to interpret.
    
    // Extract title
    const title = document.title;
    
    // Attempt to extract main visible text (excluding scripts, styles, nav)
    const clone = document.cloneNode(true) as Document;
    const elementsToRemove = clone.querySelectorAll('script, style, nav, footer, header, noscript, iframe');
    elementsToRemove.forEach(el => el.remove());
    
    // Clean up text
    let visibleText = clone.body.textContent || '';
    visibleText = visibleText.replace(/\s+/g, ' ').trim();
    
    // We send this as the "about" field and let the backend/AI figure it out
    return {
      name: title,
      headline: '',
      about: visibleText.substring(0, 10000), // Cap length
      location: '',
      profile_url: window.location.href,
      source: 'generic',
      skills: [],
      experience: [],
      education: [],
      certifications: [],
      projects: []
    };
  }
}

// Listen for messages from the popup/background script to trigger extraction
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EXTRACT_PROFILE') {
    const extractor = new GenericExtractor();
    extractor.extractProfile().then(profile => {
      sendResponse({ success: true, profile });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep the message channel open for async response
  }
});
