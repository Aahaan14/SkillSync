import { Profile, ProfileExtractor } from '../../types';

class LinkedInExtractor implements ProfileExtractor {
  async extractProfile(): Promise<Profile> {
    // Isolating LinkedIn-specific selectors here.
    // They are fragile and subject to change, so keeping them isolated is best practice.
    
    const getText = (selector: string): string => {
      const el = document.querySelector(selector);
      return el ? (el.textContent || '').trim() : '';
    };

    const getList = (selector: string): string[] => {
      const elements = document.querySelectorAll(selector);
      return Array.from(elements).map(el => (el.textContent || '').trim()).filter(Boolean);
    };

    const profile: Profile = {
      name: getText('h1.text-heading-xlarge'),
      headline: getText('div.text-body-medium.break-words'),
      location: getText('span.text-body-small.inline.t-black--light.break-words'),
      about: getText('div#about ~ div .display-flex .visually-hidden'), // very fragile
      profile_url: window.location.href,
      source: 'linkedin',
      skills: [],
      experience: [],
      education: [],
      certifications: [],
      projects: []
    };

    // Skills extraction (requires expanding the skills section usually)
    // For MVP, we might just look for the skills section or fallback to text search
    const skillElements = getList('a[data-field="skill_page_skill_topic"] span[aria-hidden="true"]');
    profile.skills = skillElements.map(s => ({ name: s }));

    // Experience extraction (simplified)
    const expElements = document.querySelectorAll('#experience ~ .pvs-list__outer-container > ul > li');
    expElements.forEach(el => {
      const title = el.querySelector('div.display-flex.align-items-center span[aria-hidden="true"]')?.textContent?.trim();
      const company = el.querySelector('span.t-14.t-normal span[aria-hidden="true"]')?.textContent?.trim();
      if (title) {
        profile.experience.push({
          title,
          company
        });
      }
    });

    // Education extraction (simplified)
    const eduElements = document.querySelectorAll('#education ~ .pvs-list__outer-container > ul > li');
    eduElements.forEach(el => {
      const institution = el.querySelector('div.display-flex.align-items-center span[aria-hidden="true"]')?.textContent?.trim();
      const degree = el.querySelector('span.t-14.t-normal span[aria-hidden="true"]')?.textContent?.trim();
      if (institution) {
        profile.education.push({
          institution,
          degree
        });
      }
    });

    return profile;
  }
}

// Listen for messages from the popup/background script to trigger extraction
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EXTRACT_PROFILE') {
    const extractor = new LinkedInExtractor();
    extractor.extractProfile().then(profile => {
      sendResponse({ success: true, profile });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep the message channel open for async response
  }
});
