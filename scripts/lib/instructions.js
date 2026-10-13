/**
 * scripts/lib/instructions.js
 *
 * Reads the Markdown instruction files under .context/instructions/ and turns
 * them into plain data. No network, no API key — this is the deterministic half
 * of the generation workflow (the optional AI refinement lives in generate-pom.js
 * / generate-tests.js and is strictly opt-in).
 *
 * Supported section spellings (both dialects used in this repo):
 *   ## Fixture | ## Fixtures
 *   ## Pages Involved | ## Page Objects
 *   ## Test Scenarios | ## Test Cases
 *   ## URL | ## Elements | ## Actions | ## Notes
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const INSTRUCTION_DIR = path.join(ROOT, '.context', 'instructions');
export const PAGES_DIR = path.join(ROOT, 'src', 'pages');

export function listInstructionFiles(kind) {
  const dir = path.join(INSTRUCTION_DIR, kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => ({ name: file.replace(/\.md$/, ''), path: path.join(dir, file) }));
}

function read(file) {
  return readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

/** Split markdown into `{ title, lines }` sections at `## ` headings. */
export function sections(markdown) {
  const out = [];
  let current = { title: '', lines: [] };
  for (const line of markdown.split('\n')) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) {
      if (current.title || current.lines.length) out.push(current);
      current = { title: match[1], lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  out.push(current);
  return out.filter((section) => section.title || section.lines.length);
}

function findSection(list, pattern) {
  return list.find((section) => pattern.test(section.title));
}

/** "Page heading" → pageHeading, "Brand link — Pemnet" → brandLinkPemnet */
export function identifierFor(text) {
  const words = String(text)
    .replace(/[`"'()]/g, ' ')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  return words
    .map((word, index) => (index === 0 ? word[0].toLowerCase() + word.slice(1) : word[0].toUpperCase() + word.slice(1)))
    .join('');
}

/** "testweb-home-page" → TestWebHomePage-style name, matched later against real classes. */
export function classNameFor(slug) {
  return slug
    .split('-')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('');
}

export function normalizeName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Registry of the Page Objects that already exist, keyed by normalized class
 * name. Generation reuses these instead of writing duplicates.
 */
export function pageRegistry() {
  const registry = new Map();
  if (!existsSync(PAGES_DIR)) return registry;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.js') || entry.name.startsWith('base')) continue;
      const source = read(full);
      for (const match of source.matchAll(/export class (\w+)/g)) {
        registry.set(normalizeName(match[1]), { className: match[1], file: full, source });
      }
    }
  };
  walk(PAGES_DIR);
  return registry;
}

/** Find an existing Page Object for a page instruction slug. */
export function matchPageObject(slug, registry = pageRegistry()) {
  const candidates = [slug, slug.replace(/-page$/, ''), `${slug}-page`];
  for (const candidate of candidates) {
    const hit = registry.get(normalizeName(classNameFor(candidate)));
    if (hit) return hit;
  }
  return null;
}

const BULLET = /^\s*[-*]\s+(.*)$/;

function splitDashCell(value) {
  // "Name — `selector` — description" (name may itself contain an em dash)
  const backtick = /`(.*?)`/.exec(value);
  if (!backtick) return { name: value.trim(), selector: '', description: '' };
  const before = value.slice(0, backtick.index).replace(/\s*—\s*$/, '').trim();
  const after = value.slice(backtick.index + backtick[0].length).replace(/^\s*—\s*/, '').trim();
  return { name: before, selector: backtick[1], description: after };
}

export function parsePageInstruction(file) {
  const markdown = read(file);
  const list = sections(markdown);
  const title = (/^#\s+(.+?)\s*$/m.exec(markdown) ?? [])[1] ?? path.basename(file, '.md');

  const urlSection = findSection(list, /^url$/i);
  const urlRaw = (urlSection?.lines.join(' ') ?? '').match(/`([^`]+)`/)?.[1] ?? '/';

  const elementsSection = findSection(list, /^elements$/i);
  const elements = (elementsSection?.lines ?? [])
    .map((line) => BULLET.exec(line)?.[1])
    .filter(Boolean)
    .map((cell) => {
      const { name, selector, description } = splitDashCell(cell);
      return { name, property: identifierFor(name), selector, description };
    })
    .filter((element) => element.selector);

  const actionsSection = findSection(list, /^actions$/i);
  const actions = (actionsSection?.lines ?? [])
    .map((line) => BULLET.exec(line)?.[1])
    .filter(Boolean)
    .map((cell) => {
      const { name, selector: signature, description } = splitDashCell(cell);
      return { name, method: identifierFor(name.replace(/^(click|get|fill|navigate to|sign out|select)\s+/i, '$1 ')), signature, note: description };
    })
    .filter((action) => action.signature);

  const notesSection = findSection(list, /^notes$/i);
  const notes = (notesSection?.lines ?? []).map((line) => BULLET.exec(line)?.[1]).filter(Boolean);

  return { slug: path.basename(file, '.md'), title, url: urlRaw, elements, actions, notes, file };
}

function parseTestBlocks(markdown) {
  const blocks = markdown.split(/^###\s+/m).slice(1);
  return blocks.map((block) => {
    const [headingLine, ...rest] = block.split('\n');
    const id = /^([A-Z]+-[A-Z0-9-]+)\b/.exec(headingLine)?.[1] ?? '';
    const name = headingLine.replace(id, '').replace(/^\s*[—-]\s*/, '').trim();
    const body = rest.join('\n');
    const precondition = /\*\*Precondition:\*\*\s*(.+)|Precondition:\s*(.+)/.exec(body)?.[1] ?? '';
    const expected = /\*\*Expected:\*\*\s*(.+?)((?=\n\s*(?:\*\*)?(?:Steps|Precondition|Notes):)|$)/s
      .exec(body)?.[1] ?? '';
    const steps = [...body.matchAll(/^\s*(?:\d+[-.)]|[-*])\s+(.+)$/gm)].map((match) => match[1].trim());
    return {
      id,
      name,
      precondition: precondition.trim(),
      steps,
      expected: expected.replace(/\s+/g, ' ').trim(),
    };
  }).filter((test) => test.id);
}

export function parseFeatureInstruction(file) {
  const markdown = read(file);
  const list = sections(markdown);
  const title = (/^#\s+(.+?)\s*$/m.exec(markdown) ?? [])[1] ?? path.basename(file, '.md');

  const fixtureSection = findSection(list, /^fixtures?$/i);
  const fixture = (fixtureSection?.lines.join(' ') ?? '').match(/`([^`]+?\.?(?:fixture|js)?)`/)?.[1] ?? 'base.fixture';

  const pagesSection = findSection(list, /^(pages involved|page objects)$/i);
  const pages = (pagesSection?.lines ?? [])
    .map((line) => BULLET.exec(line)?.[1])
    .filter(Boolean)
    .map((cell) => {
      const classes = [...cell.matchAll(/`(\w+)`/g)].map((match) => match[1]);
      const importPath = /from\s+`([^`]+)`/.exec(cell)?.[1] ?? '';
      const description = cell.split('—').slice(1).join('—').trim();
      return { className: classes[0], importPath, description };
    })
    .filter((page) => page.className);

  const scenarioSection = findSection(list, /^(test scenarios|test cases)$/i);
  const tests = parseTestBlocks(scenarioSection?.lines.join('\n') ?? '');

  const descriptionSection = findSection(list, /^description$/i);
  const description = (descriptionSection?.lines.join(' ') ?? '').trim();

  return { slug: path.basename(file, '.md'), title, fixture, pages, tests, description, file };
}
