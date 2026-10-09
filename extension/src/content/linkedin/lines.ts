/**
 * Turn a page (or part of one) into the lines of text a person would read.
 *
 * This is the structure-agnostic fallback used when LinkedIn's markup has no
 * headings, list items or accessibility spans to hang a structural parser on.
 * It depends only on two facts that survive any redesign: text lives in text
 * nodes, and block-level elements start new lines.
 */

const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'BUTTON', 'DD', 'DETAILS', 'DIV', 'DL', 'DT',
  'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'SUMMARY', 'TABLE', 'TBODY',
  'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL', 'BR',
]);

/** Never contain readable profile text (LinkedIn also embeds JSON blobs in <code>). */
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'TEMPLATE', 'CODE', 'IFRAME', 'INPUT', 'TEXTAREA',
  'SELECT', 'OPTION', 'CANVAS', 'VIDEO', 'AUDIO', 'IMG', 'PICTURE',
]);

/** Screen-reader-only copies of text that is already visible elsewhere. */
const VISUALLY_HIDDEN = /(^|[\s_-])(visually-hidden|sr-only|screen-reader|a11y-text)([\s_-]|$)/i;

/** Lines that are interface chrome, never profile content. */
const CHROME_LINES =
  /^(show all.*|see more|…\s*see more|\.\.\.\s*see more|see less|show less|show credential|see credential|follow|following|message|connect|more|save|send|pending|\d+\s*(new )?notifications?)$/i;

const PUNCTUATION_ONLY = /^[\s·•–—|…\-.,:;()↗→]*$/;

function isHidden(el: Element): boolean {
  if (el.hasAttribute('hidden')) return true;
  const cls = el.getAttribute('class');
  if (cls && VISUALLY_HIDDEN.test(cls)) return true;
  // Chrome 105+: display:none / visibility:hidden anywhere up the tree.
  const check = (el as Element & { checkVisibility?: (o?: object) => boolean }).checkVisibility;
  if (typeof check === 'function') {
    try {
      return !check.call(el, { checkVisibilityCSS: true });
    } catch {
      return false;
    }
  }
  return false;
}

/** "TitleTitle" / "Title Title" -> "Title" (a visible copy followed by a hidden copy). */
export function collapseDoubled(line: string): string {
  const n = line.length;
  if (n >= 6 && n % 2 === 0 && line.slice(0, n / 2) === line.slice(n / 2)) return line.slice(0, n / 2);
  if (n >= 7 && n % 2 === 1) {
    const half = (n - 1) / 2;
    if (line[half] === ' ' && line.slice(0, half) === line.slice(half + 1)) return line.slice(0, half);
  }
  return line;
}

export function collectLines(root: Element): string[] {
  const out: string[] = [];
  let buffer = '';

  const flush = () => {
    const line = collapseDoubled(buffer.replace(/\s+/g, ' ').trim());
    buffer = '';
    if (!line || PUNCTUATION_ONLY.test(line) || CHROME_LINES.test(line)) return;
    if (out[out.length - 1] === line) return; // consecutive duplicate
    out.push(line);
  };

  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      buffer += node.nodeValue ?? '';
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    if (SKIP_TAGS.has(el.tagName.toUpperCase()) || isHidden(el)) return;

    const block = BLOCK_TAGS.has(el.tagName.toUpperCase());
    if (block) flush();
    for (const child of Array.from(el.childNodes)) walk(child);
    if (block) flush();
  };

  walk(root);
  flush();
  return out;
}
