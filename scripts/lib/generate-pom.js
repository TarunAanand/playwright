/**
 * scripts/lib/generate-pom.js
 *
 * Builds (or reuses) a Page Object for a page instruction file. Deterministic by
 * default; an Anthropic refinement pass runs only with `ai: true` + ANTHROPIC_API_KEY.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { ROOT, classNameFor, listInstructionFiles, matchPageObject, normalizeName, pageRegistry, parsePageInstruction } from './instructions.js';
import { renderPom } from './templates.js';
import { maybeRefineWithAI } from './llm.js';

const PAGES_ROOT = path.join(ROOT, 'src', 'pages');

/** Which src/pages/<portal>/ folder a page instruction belongs to. */
function portalDirFor(markdownText, className) {
  if (/test\s*web|configurator/i.test(markdownText)) return 'testweb';
  if (/admin/i.test(markdownText)) return 'admin';
  return /^TestWeb/i.test(className) ? 'testweb' : 'admin';
}

export async function generatePom({ page_name: pageName, source = 'local', force = false, ai = false } = {}) {
  if (!pageName) throw new Error('generatePom requires page_name');
  const registry = pageRegistry();

  const byClassName = registry.get(normalizeName(pageName));
  const instruction = byClassName
    ? listInstructionFiles('pages').find((file) => normalizeName(classNameFor(file.name)) === normalizeName(byClassName.className))
    : null;

  const parsed = instruction ? parsePageInstruction(instruction.path) : null;
  if (!parsed) {
    return { status: 'skipped', className: pageName, reason: `No page instruction matches "${pageName}" (add .context/instructions/pages/<slug>.md)` };
  }

  if (byClassName && !force) {
    return { status: 'reused', className: byClassName.className, file: byClassName.file, instruction: instruction.path };
  }

  const markdownText = readFileSync(instruction.path, 'utf8');
  const portal = portalDirFor(markdownText, byClassName?.className ?? pageName);
  const className = byClassName?.className ?? deriveClassName(instruction.name, portal);
  const target = path.join(PAGES_ROOT, portal, `${className}.js`);
  const importDepth = 1;

  let code = renderPom({ className, instruction: parsed, importDepth });
  const refinement = await maybeRefineWithAI({ kind: 'pom', promptFile: '.context/prompts/pom-generator.md', context: markdownText, draft: code, ai });
  if (refinement.applied) code = refinement.code;

  if (byClassName && force) {
    writeFileSync(`${target}.bak`, readFileSync(byClassName.file, 'utf8'));
  }
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, code);

  return { status: force && byClassName ? 'rewritten' : 'generated', className, file: target, instruction: instruction.path, ai: refinement.applied, backup: force && byClassName ? `${target}.bak` : null };
}

/** testweb-home-page → TestWebHomePage (keeps the real casing used in this repo). */
function deriveClassName(slug, portal) {
  const base = slug.replace(/-page$/, '');
  const words = base.split('-').map((word) => {
    if (word === 'testweb') return 'TestWeb';
    if (word === 'admin') return 'Admin';
    if (word === 'cad' || word === '3d') return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
  if (words[0] !== 'Admin' && words[0] !== 'TestWeb' && portal) words.unshift(portal === 'testweb' ? 'TestWeb' : 'Admin');
  return `${words.join('')}Page`;
}

export function listPageInstructions() {
  return listInstructionFiles('pages');
}

export function pageInstructionExists(file) {
  return existsSync(file);
}
