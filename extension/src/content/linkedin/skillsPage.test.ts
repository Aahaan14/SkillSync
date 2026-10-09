// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseSkillsPage, readSkillsWhenReady } from './skillsPage';

const docOf = (html: string) => new DOMParser().parseFromString(html, 'text/html');

/** One skill row the way LinkedIn renders it: visible span + screen-reader twin, then detail lines. */
const row = (name: string, ...details: string[]) =>
  `<li><a href="#"><span aria-hidden="true">${name}</span><span class="visually-hidden">${name}</span></a>${details
    .map((d) => `<div><span aria-hidden="true">${d}</span></div>`)
    .join('')}</li>`;

const PAGE = `<html><body><main>
  <h1>Skills</h1>
  <ul class="tabs"><li><button>All</button></li><li><button>Industry Knowledge</button></li></ul>
  <ul>
    ${row('Java', '12 endorsements', 'Software Engineer at Acme')}
    ${row('Angular')}
    ${row('Spring Boot', 'Passed LinkedIn Skill Assessment')}
    ${row('java')}
  </ul>
</main></body></html>`;

describe('parseSkillsPage', () => {
  it('reads every skill once, in order, with endorsement counts', () => {
    expect(parseSkillsPage(docOf(PAGE))).toEqual([
      { name: 'Java', endorsements: 12 },
      { name: 'Angular', endorsements: undefined },
      { name: 'Spring Boot', endorsements: undefined },
    ]);
  });

  it('ignores filter tabs and returns [] for a page without a list', () => {
    expect(parseSkillsPage(docOf('<html><body><main><ul><li>All</li><li>Skills</li></ul></main></body></html>'))).toEqual([]);
    expect(parseSkillsPage(docOf('<html><body></body></html>'))).toEqual([]);
  });
});

describe('readSkillsWhenReady', () => {
  it('waits for the rest of the list instead of returning the first batch', async () => {
    const doc = docOf(`<html><body><main><ul id="l">${row('Java')}</ul></main></body></html>`);
    const list = doc.getElementById('l')!;
    setTimeout(() => list.insertAdjacentHTML('beforeend', row('Angular')), 100);
    setTimeout(() => list.insertAdjacentHTML('beforeend', row('Docker')), 250);
    const skills = await readSkillsWhenReady(doc, { quietMs: 200, maxMs: 2000 });
    expect(skills.map((s) => s.name)).toEqual(['Java', 'Angular', 'Docker']);
  });

  it('gives up after maxMs on an empty page', async () => {
    const started = Date.now();
    const skills = await readSkillsWhenReady(docOf('<html><body><main></main></body></html>'), { quietMs: 50, maxMs: 300 });
    expect(skills).toEqual([]);
    expect(Date.now() - started).toBeLessThan(1500);
  });
});
