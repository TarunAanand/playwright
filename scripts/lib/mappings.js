/**
 * scripts/lib/mappings.js
 *
 * Feature-name → spec-file mappings. Generation writes to the same location the
 * maintained suite already uses, so a regenerated file never appears as a
 * duplicate spec. Every feature instruction file must resolve to a mapping —
 * unmapped features are reported as errors instead of being skipped silently.
 */
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { ROOT, normalizeName, pageRegistry } from './instructions.js';

export const TESTS_DIR = path.join(ROOT, 'tests');

/** Slugs whose maintained spec file is named differently from the feature. */
export const SPEC_NAME_ALIASES = {
  'admin-login-flow': 'admin-login',
  'testweb-login-flow': 'testweb-login',
  'testweb-registration': 'testweb-register',
  'testweb-installation-system-flow': 'installation-system',
  'testweb-machine-configuration-flow': 'machine-configuration',
};

export function specBaseName(featureSlug) {
  return SPEC_NAME_ALIASES[featureSlug] ?? featureSlug;
}

/** Look for tests/**\/<base>.spec.js so existing specs are detected anywhere. */
export function findExistingSpec(featureSlug, base = specBaseName(featureSlug)) {
  if (!existsSync(TESTS_DIR)) return null;
  const stack = [TESTS_DIR];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { stack.push(full); continue; }
      if (entry.name === `${base}.spec.js`) return full;
    }
  }
  return null;
}

/** Default destination when no maintained spec exists yet. */
export function defaultSpecPath(featureSlug) {
  const base = specBaseName(featureSlug);
  return path.join(TESTS_DIR, base, `${base}.spec.js`);
}

/** Resolve a Page Object class name to { className, relativeImport } for a spec. */
export function resolvePageObject(className, specFile, registry = pageRegistry()) {
  const hit = registry.get(normalizeName(className));
  if (!hit) return null;
  let rel = path.relative(path.dirname(specFile), hit.file).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return { className: hit.className, importPath: rel, file: hit.file };
}
