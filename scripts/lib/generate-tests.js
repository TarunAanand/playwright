/**
 * scripts/lib/generate-tests.js
 *
 * Builds a spec file for a feature instruction file. Existing, hand-maintained
 * specs are detected by file name anywhere under tests/ and are left untouched
 * unless --force is passed (in which case a .bak copy is written first).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { ROOT, listInstructionFiles, pageRegistry, parseFeatureInstruction, parsePageInstruction, matchPageObject } from './instructions.js';
import { defaultSpecPath, findExistingSpec, resolvePageObject, specBaseName } from './mappings.js';
import { renderSpec } from './templates.js';
import { generatePom } from './generate-pom.js';
import { maybeRefineWithAI } from './llm.js';

const TESTS_DIR = path.join(ROOT, 'tests');

function normalizeFixtureName(value) {
  const base = String(value ?? 'base.fixture').replace(/^`|`$/g, '');
  return base.endsWith('.js') ? base : `${base.replace(/\.fixture$/, '')}.fixture.js`;
}

export async function generateTests({ feature_name: featureName, pages_used: pagesUsed = [], source = 'local', force = false, ai = false } = {}) {
  if (!featureName) throw new Error('generateTests requires feature_name');

  const instruction = listInstructionFiles('features').find((file) => file.name === featureName);
  if (!instruction) {
    return { status: 'skipped', feature: featureName, reason: 'No feature instruction file under .context/instructions/features/' };
  }

  const feature = parseFeatureInstruction(instruction.path);
  const existing = findExistingSpec(featureName);
  const specPath = existing ?? defaultSpecPath(featureName);

  if (existing && !force) {
    return { status: 'reused', feature: featureName, file: existing, tests: feature.tests.length };
  }

  const registry = pageRegistry();
  const requested = [...new Set([...feature.pages.map((page) => page.className), ...pagesUsed])].filter(Boolean);

  const resolved = [];
  const missing = [];
  for (const className of requested) {
    let hit = resolvePageObject(className, specPath, registry);
    if (!hit) {
      await generatePom({ page_name: className, source, ai });
      hit = resolvePageObject(className, specPath, pageRegistry());
    }
    if (hit) resolved.push(hit);
    else missing.push(className);
  }

  const prefix = fixturesPrefixFor(specPath);
  let code = renderSpec({
    feature,
    resolvedPages: resolved,
    fixtureName: normalizeFixtureName(feature.fixture),
    depthPrefix: prefix,
  });

  const instructionText = readFileSync(instruction.path, 'utf8');
  const refinement = await maybeRefineWithAI({ kind: 'test spec', promptFile: '.context/prompts/test-generator.md', context: instructionText, draft: code, ai });
  if (refinement.applied) code = refinement.code;

  if (existing && force) writeFileSync(`${existing}.bak`, readFileSync(existing, 'utf8'));
  mkdirSync(path.dirname(specPath), { recursive: true });
  writeFileSync(specPath, code);

  return {
    status: existing && force ? 'rewritten' : 'generated',
    feature: featureName,
    file: specPath,
    tests: feature.tests.length,
    pages: resolved.map((page) => page.className),
    missingPages: missing,
    ai: refinement.applied,
    backup: existing && force ? `${existing}.bak` : null,
  };
}

/** tests/<dir>/<file>.spec.js → '../' ; tests/<file>.spec.js → './' */
function fixturesPrefixFor(specPath) {
  const rel = path.relative(path.dirname(specPath), TESTS_DIR).split(path.sep).filter(Boolean).length;
  return rel === 0 ? './' : '../'.repeat(rel);
}

export function listFeatureInstructions() {
  return listInstructionFiles('features');
}

export { matchPageObject, parsePageInstruction, specBaseName };
