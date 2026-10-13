/**
 * scripts/gen-pom.js
 *
 * CLI — generate Page Objects for every page instruction file found in
 * .context/instructions/pages/.
 *
 *   node scripts/gen-pom.js                 generate anything missing, reuse the rest
 *   node scripts/gen-pom.js --only admin-login-page
 *   node scripts/gen-pom.js --force         rewrite existing POMs (writes .bak files)
 *   node scripts/gen-pom.js --ai            ask Anthropic to refine (needs ANTHROPIC_API_KEY)
 *
 * Deterministic by default: no API key, no network. Reused Page Objects are the
 * maintained classes in src/pages, so generation cannot fork a second copy of a
 * POM or drop locators that the suite relies on.
 */
import 'dotenv/config';
import path from 'node:path';

import { listInstructionFiles, matchPageObject, pageRegistry } from './lib/instructions.js';
import { generatePom } from './lib/generate-pom.js';

const relative = (target) => path.relative(process.cwd(), target);

const args = process.argv.slice(2);
const force = args.includes('--force');
const ai = args.includes('--ai');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

const files = only
  ? listInstructionFiles('pages').filter((file) => file.name === only || file.name === `${only}-page`)
  : listInstructionFiles('pages');

if (files.length === 0) {
  console.log(only ? `No page instruction matched "${only}"` : 'No page instruction files found in .context/instructions/pages/');
  process.exit(only ? 1 : 0);
}

console.log(`\nGenerating Page Objects for ${files.length} page instruction(s)...`);
if (!force) console.log('Existing Page Objects are reused; pass --force to rewrite them (a .bak copy is kept).\n');

const registry = pageRegistry();
const summary = { generated: 0, reused: 0, skipped: 0, failed: 0 };
const unmapped = [];

for (const file of files) {
  const existing = matchPageObject(file.name, registry);
  if (existing && !force) {
    console.log(`  = ${existing.className}  (reused: ${relative(existing.file)})`);
    summary.reused += 1;
    continue;
  }

  try {
    const result = await generatePom({ page_name: file.name, source: 'local', force, ai });
    if (result.status === 'skipped') {
      console.log(`  ! ${file.name}: ${result.reason}`);
      summary.skipped += 1;
      unmapped.push(file.name);
      continue;
    }
    console.log(`  + ${result.className}  (${relative(result.file)}${result.ai ? ', AI refined' : ''})`);
    summary[result.status === 'rewritten' ? 'reused' : 'generated'] += 1;
  } catch (error) {
    console.error(`  x ${file.name}: ${error.message}`);
    summary.failed += 1;
  }
}

console.log(`\ngen:pom complete — ${summary.generated} generated, ${summary.reused} reused, ${summary.skipped} unmapped, ${summary.failed} failed.`);
if (unmapped.length) {
  console.log('Unmapped page instructions (add a matching ## URL/## Elements file or a POM):');
  for (const name of unmapped) console.log(`  - ${name}`);
}
process.exit(summary.failed > 0 ? 1 : 0);
