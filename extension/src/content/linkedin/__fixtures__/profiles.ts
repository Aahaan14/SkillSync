/**
 * Synthetic LinkedIn-style pages (fictional person). They reproduce the
 * structural traits the parser depends on: headings, a duplicated
 * aria-hidden / visually-hidden span per line, nested role lists and
 * "+N skills" lines. They validate the parsing LOGIC; they are not captures of
 * the live site, so they cannot prove LinkedIn's current markup still matches.
 */

/** One visible line, rendered the way LinkedIn does: visible copy + screen-reader copy. */
export const line = (text: string): string =>
  `<span aria-hidden="true">${text}</span><span class="visually-hidden">${text}</span>`;

const heading = (text: string): string => `<h2>${line(text)}</h2>`;

const item = (...lines: string[]): string => `<li>${lines.map((l) => `<div>${line(l)}</div>`).join('')}</li>`;

const TOP_CARD = `
  <section>
    <div>
      <h1>Jane Doe</h1><span>· 3rd</span>
      <div>Senior Product Designer, Fintech | Building clear interfaces</div>
      <div><span>Pune, Maharashtra, India</span> · <a href="#">Contact info</a></div>
      <div>500+ connections</div>
      <button>Message</button>
    </div>
  </section>`;

const ABOUT = `
  <section>${heading('About')}
    <div>${line('I design calm, accessible interfaces for financial products and mentor junior designers.')}
    <button>…see more</button></div>
  </section>`;

const EXPERIENCE_ITEMS = `
  ${item(
    'Senior Product Designer',
    'Acme Payments · Full-time',
    'Jan 2022 - Present · 3 yrs 9 mos',
    'Pune, Maharashtra, India · On-site',
    'Led the redesign of the merchant dashboard and shipped a shared component library used by five squads.',
    'Figma, Design Systems and +3 skills',
  )}
  <li>
    <div>${line('Mind Ventures International')}</div>
    <div>${line('2 yrs 2 mos')}</div>
    <ul>
      ${item(
        'Graphic Designer',
        'Feb 2021 - Feb 2022 · 1 yr 1 mo',
        'Created 2100+ graphic design templates, including social media designs and videos for the app.',
        'Graphic Design, Adobe Illustrator and +2 skills',
      )}
      ${item(
        'Junior Designer',
        'Feb 2020 - Feb 2021 · 1 yr 1 mo',
        'Pune/Pimpri-Chinchwad Area',
        'Adobe Photoshop, After Effects and +4 skills',
      )}
    </ul>
  </li>`;

const EDUCATION_ITEMS = item(
  'Pune Institute of Computer Technology',
  'Bachelor of Engineering (B.E.), Information Technology',
  '2013 – 2017',
);

const CERT_ITEMS = `
  ${item('Protopie 101 Crash Course', 'ProtoPie', 'Issued Jul 2025', 'Credential ID 6887b3b53d6177db1f032154')}
  ${item('Google UX Design Certificate', 'Coursera', 'Issued Mar 2023 · Expires Mar 2026')}`;

const SKILL_ITEMS = `
  ${item('Figma', '12 endorsements')}
  ${item('UX Design')}
  ${item('Design Systems', '3 endorsements')}`;

/** Older markup: id anchors + pvs-list classes. */
export const CLASSIC_PAGE = `<!doctype html><html><head><title>(2) Jane Doe | LinkedIn</title></head><body><main>
  ${TOP_CARD}
  ${ABOUT.replace('<section>', '<section><div id="about"></div>')}
  <section><div id="experience"></div>${heading('Experience')}
    <div class="pvs-list__outer-container"><ul>${EXPERIENCE_ITEMS}</ul></div></section>
  <section><div id="education"></div>${heading('Education')}
    <div class="pvs-list__outer-container"><ul>${EDUCATION_ITEMS}</ul></div></section>
  <section><div id="licenses_and_certifications"></div>${heading('Licenses &amp; certifications')}
    <div class="pvs-list__outer-container"><ul>${CERT_ITEMS}</ul></div></section>
  <section><div id="skills"></div>${heading('Skills')}
    <div class="pvs-list__outer-container"><ul>${SKILL_ITEMS}</ul></div></section>
  <section>${heading('Interests')}<div>${line('Top Voices')}</div></section>
</main></body></html>`;

/** Redesigned markup: no ids, no pvs classes, headings found only by text. */
export const CLASSLESS_PAGE = `<!doctype html><html><head><title>Jane Doe | LinkedIn</title></head><body><main>
  ${TOP_CARD}
  <div>${ABOUT}</div>
  <div><div>${heading('Experience')}<div><div><ul>${EXPERIENCE_ITEMS}</ul></div></div></div></div>
  <div><div>${heading('Education')}<ul>${EDUCATION_ITEMS}</ul></div></div>
  <div><div>${heading('Licenses &amp; certifications (2)')}<ul>${CERT_ITEMS}</ul></div></div>
  <div><div>${heading('Skills')}<ul>${SKILL_ITEMS}</ul></div></div>
</main></body></html>`;

/** Only the top card, e.g. the page is still loading. */
export const TOP_CARD_ONLY_PAGE = `<!doctype html><html><head><title>Jane Doe | LinkedIn</title></head><body><main>${TOP_CARD}</main></body></html>`;

/** Nothing recognisable (wrong page, login wall, layout change). */
export const UNKNOWN_PAGE = `<!doctype html><html><head><title>Sign in | LinkedIn</title></head><body><main><div>Join now</div></main></body></html>`;

/**
 * Redesigned markup as I believe the live site now renders it: only divs and
 * paragraphs with obfuscated class names. No h1/h2, no <li>, no aria-hidden
 * spans. Includes a sticky header repeating the name, interface noise
 * ("Show all", "Show credential"), a hidden screen-reader copy and a sidebar.
 * Fictional person.
 */
const p = (text: string, cls = '_a1b2'): string => `<p class="${cls}">${text}</p>`;

export const TEXT_ONLY_PAGE = `<!doctype html><html><head><title>(1) Sam Rivera | LinkedIn</title></head><body>
  <div class="_nav"><div>${p('Home')}${p('My Network')}${p('Jobs')}${p('Messaging')}${p('Notifications')}</div></div>
  <div class="_sticky"><div>${p('Sam Rivera')}${p('AI/ML Builder | Researcher | Security | Product Engineer | GenAI')}</div></div>
  <div class="_main">
    <div class="_top">
      <div>${p('Sam Rivera')}<span class="visually-hidden">Sam Rivera</span>${p('· 3rd')}</div>
      <div>${p('AI/ML Builder | Researcher | Security | Product Engineer | GenAI')}</div>
      <div>${p('Ahmedabad, Gujarat, India')} · <a href="#">Contact info</a></div>
      <div>${p('500+ connections')}</div>
      <div hidden>${p('Hidden banner that must be ignored')}</div>
      <button>Message</button>
    </div>
    <div class="_card">${p('About')}<div>${p('I build practical machine learning systems and write about security.')}<button>…see more</button></div></div>
    <div class="_card">${p('Experience')}
      <div>${p('Machine Learning Engineer')}${p('Northwind Labs · Full-time')}${p('Jan 2025 - Present · 9 mos')}${p('Remote')}
        ${p('Built and deployed ranking models serving two million requests a day with strict latency limits.')}
        ${p('Python, PyTorch and +4 skills')}</div>
      <div>${p('Studio Nine')}${p('2 yrs 2 mos')}
        <div>${p('Backend Developer')}${p('Feb 2023 - Dec 2024 · 1 yr 11 mos')}${p('Built REST services and data pipelines for internal analytics tooling across teams.')}${p('FastAPI, PostgreSQL and +2 skills')}</div>
        <div>${p('Intern')}${p('Nov 2022 - Jan 2023 · 3 mos')}${p('Docker, Git and +1 skill')}</div>
      </div>
      <div>${p('Show all 4 experiences →')}</div>
    </div>
    <div class="_card">${p('Education')}
      <div>${p('Gujarat Technological University')}${p('Bachelor of Technology - BTech, Artificial Intelligence and machine learning')}${p('Sep 2024 – May 2028')}${p('C (Programming Language), C++ and +1 skill')}</div>
      <div>${p('Allen Career Institute')}${p('Higher Secondary, Jee Preparation')}${p('Apr 2022 – Mar 2024')}</div>
    </div>
    <div class="_card">${p('Courses')}${p('Experience Designer at Acme')}${p('Mar 2021 - Present')}</div>
    <div class="_card">${p('Licenses &amp; certifications (9)')}
      <div>${p('Certified Cyber Defence Professional (CCDP)')}${p('Demmisto Technologies Pvt. Ltd')}${p('Issued Sep 2026')}${p('Credential ID DTAHM-IN05815')}<button>Show credential</button>${p('Cybersecurity, Ethical Hacking and +3 skills')}
        <div>${p('CCDP Certificate - Sam Rivera')}${p('Certificate of completion for the Certified Cyber Defence Professional program.')}</div></div>
      <div>${p('Advanced Learning Algorithms')}${p('DeepLearning.AI')}${p('Issued Jun 2025 · Expires Jun 2028')}</div>
      <div>${p('Show all 9 licenses &amp; certifications →')}</div>
    </div>
    <div class="_card">${p('Interests')}${p('Top Voices')}${p('Education Weekly')}</div>
  </div>
  <div class="_side">${p('People also viewed')}${p('Pat Lee')}${p('Experience Designer at Acme')}${p('Mar 2021 - Present')}</div>
</body></html>`;

/**
 * Layout that matches the failure reported from a real page: the name is a
 * heading (no <h1>), "Skills (23)" carries a count, entries are plain divs (no
 * <li>), skills are mostly on a separate page, and there are sidebar headings that
 * are not profile data. Fictional person.
 */
const d = (...lines: string[]): string => `<div class="_entry">${lines.map((l) => `<p>${l}</p>`).join('')}</div>`;
const h = (text: string): string => `<h2 class="_t">${text}</h2>`;

export const SDUI_PAGE = `<!doctype html><html><head><title>(4) Riya Shah | LinkedIn</title></head><body>
  <header><nav><h2>Navigation</h2><p>Home</p><p>My Network</p></nav></header>
  <main>
    <section class="_top">
      <div><h2 class="_name">Riya Shah</h2><p>· 2nd</p></div>
      <p>Data Analyst | SQL, Python and dashboards</p>
      <p>Mumbai, Maharashtra, India · <a href="/in/riya/overlay/contact-info/">Contact info</a></p>
      <p>312 connections</p>
    </section>
    <section>${h('About')}<div><p>I turn messy operational data into dashboards people actually use.</p><button>…see more</button></div></section>
    <section>${h('Activity')}<p>312 followers</p><p>Riya has not posted yet</p></section>
    <section>${h('Experience')}
      ${d('Data Analyst', 'Orbit Retail · Full-time', 'Mar 2024 - Present · 1 yr 7 mos', 'Mumbai, Maharashtra, India · Hybrid', 'Built weekly sales dashboards and automated the reporting pipeline for four regional teams.', 'SQL, Power BI and +2 skills')}
      ${d('Analytics Intern', 'Orbit Retail · Internship', 'Jun 2023 - Feb 2024 · 9 mos', 'Cleaned and joined store-level datasets for the finance team.')}
      ${d('Freelance Researcher', 'Self-employed', '2022 - 2023')}
    </section>
    <section>${h('Education')}
      ${d('University of Mumbai', 'Bachelor of Science - BSc, Statistics', '2019 – 2022')}
      ${d('St. Xavier’s College', '2017 – 2019')}
    </section>
    <section>${h('Licenses &amp; certifications')}
      ${d('Google Data Analytics Professional Certificate', 'Coursera', 'Issued Jan 2024', 'Credential ID ABC123XYZ', '<a href="https://www.coursera.org/verify/ABC123XYZ">Show credential</a>')}
      ${d('SQL Fundamentals', 'DataCamp', 'Issued Aug 2023')}
    </section>
    <section>${h('Skills (23)')}
      ${d('SQL', '4 endorsements')}
      ${d('Power BI')}
      <a href="/in/riya/details/skills/">Show all 23 skills</a>
    </section>
    <section>${h('Interests')}<p>Top Voices</p></section>
    <aside>
      ${h('People you may know')}${d('Aman Verma', 'Experience Designer at Acme', 'Mar 2021 - Present')}
      ${h('Explore Premium profiles')}${h('Ad Options')}${h("Don't want to see this")}${h('You might like')}
    </aside>
  </main>
</body></html>`;

/** Top card and About have rendered; everything below is still a loading placeholder. */
export const PARTIAL_LOAD_PAGE = `<!doctype html><html><head><title>Riya Shah | LinkedIn</title></head><body><main>
  <section><div><h2>Riya Shah</h2></div><p>Data Analyst | SQL, Python and dashboards</p><p>Mumbai, Maharashtra, India</p></section>
  <section>${h('About')}<div><p>I turn messy operational data into dashboards people actually use.</p></div></section>
  <section aria-busy="true"><div class="artdeco-loader"></div><div class="skeleton-block"></div></section>
</main></body></html>`;

/** Sections whose headings rendered but whose entries did not (or the person has none). */
export const EMPTY_SECTIONS_PAGE = `<!doctype html><html><head><title>Riya Shah | LinkedIn</title></head><body><main>
  <section><div><h2>Riya Shah</h2></div><p>Data Analyst | SQL, Python and dashboards</p><p>Mumbai, Maharashtra, India</p></section>
  <section>${h('About')}<div><p>Short bio.</p></div></section>
  <section>${h('Experience')}</section>
  <section>${h('Education')}</section>
</main></body></html>`;

/** A finished page of a person who has only About and Education. */
export const MINIMAL_COMPLETE_PAGE = `<!doctype html><html><head><title>Riya Shah | LinkedIn</title></head><body><main>
  <section><div><h2>Riya Shah</h2></div><p>Data Analyst | SQL, Python and dashboards</p><p>Mumbai, Maharashtra, India</p></section>
  <section>${h('About')}<div><p>Short bio.</p></div></section>
  <section>${h('Education')}${d('University of Mumbai', 'Bachelor of Science - BSc, Statistics', '2019 – 2022')}</section>
</main></body></html>`;

/**
 * LinkedIn wraps sections in `display: contents` elements (no box of their own). The
 * top card is inside one, and a stale headline sits in a display:none copy. Fictional person.
 */
export const DISPLAY_CONTENTS_PAGE = `<!doctype html><html><head><title>Jeel Nandha | LinkedIn</title></head><body><main>
  <div style="display:contents">
    <section><div style="display:contents"><div style="display:contents"><h2>Jeel Nandha</h2></div>
      <div><p>AI/ML Builder | Researcher | Security</p></div>
      <div><p>Ahmedabad, Gujarat, India</p></div></div></section>
    <div style="display:none"><p>Stale mobile headline</p></div>
    <section>${h('About')}<div><p>I build ML systems.</p></div></section>
    <section>${h('Experience')}<div style="display:contents">${d(
      'Machine Learning Engineer',
      'Northwind Labs · Full-time',
      'Jan 2025 - Present · 9 mos',
      'Remote',
      'Built ranking models for production traffic at scale.',
    )}</div></section>
  </div>
</main></body></html>`;
